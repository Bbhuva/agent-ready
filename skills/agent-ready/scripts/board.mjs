#!/usr/bin/env node
// agent-ready board
//
// Reads the phase plans, the backlog and the operator's to-do list, and tells
// agents what they need to know before they start work: what is ready, who is
// working on what, which items would touch the same files, and whether the
// dependencies make sense. Claims live in one file that every git worktree of
// this repo shares, so two agents cannot take the same item, or items that
// touch the same files. No dependencies. Node 18 or newer.
//
//   node .agents/scripts/board.mjs                          ready, in progress, waiting, problems
//   node .agents/scripts/board.mjs ready                    items that can be started now
//   node .agents/scripts/board.mjs claim <id> --agent <name>
//   node .agents/scripts/board.mjs resume <id> --agent <name> [--take-over]   pick up work someone stopped partway
//   node .agents/scripts/board.mjs release <id>
//   node .agents/scripts/board.mjs undo <id> [--yes]           go back to before an item's save points
//   node .agents/scripts/board.mjs check                    exit code 1 if the plans have problems
//   node .agents/scripts/board.mjs graph                    write docs/build/graph.md (Mermaid)
//
// Parallel mode (run by the coordinator, in the main checkout):
//   node .agents/scripts/board.mjs next [--max <n>]          a batch of ready items whose files don't overlap
//   node .agents/scripts/board.mjs start <id> --agent <name> claim it, make its worktree and branch, print the brief
//   node .agents/scripts/board.mjs merge <id>                rebase, check, merge, record, clean up; undo if checks fail
//
// Add --json to status and ready for output a script can read. Settings for
// parallel mode (main branch, where worktrees go, how many builders, which
// checks to run) live in .agents/board.json.

import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// A claim older than this shows up as stale.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const STATUS = { " ": "todo", "~": "doing", "!": "blocked", x: "done", X: "done", "-": "dropped" };
const ITEM_LINE = /^(\s*)- \[([ xX~!-])\] \*\*([a-z][a-z0-9]*-\d+)\*\*\s*(.*)$/;
const FIELD_LINE = /^\s+- \*\*(Depends|Touches|Claimed|Blocked):\*\*\s*(.*)$/;
const ITEM_ID = /[a-z][a-z0-9]*-\d+/g;

// ---------------------------------------------------------------------------
// Reading the plans
// ---------------------------------------------------------------------------

export function findRoot(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, "docs", "build"))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

function phaseNumber(name) {
  const match = name.match(/^phase-(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

// Phase plans in order, then the operator's to-do list and the backlog.
// `order` decides which items may depend on which: operator to-dos (-1) can be
// depended on by anything; backlog items (Infinity) by nothing.
function sourceFiles(root) {
  const phasesDir = path.join(root, "docs", "build", "phases");
  const phases = existsSync(phasesDir)
    ? readdirSync(phasesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(path.join(phasesDir, entry.name, "plan.md")))
        .map((entry) => ({ file: path.join(phasesDir, entry.name, "plan.md"), phase: entry.name, order: phaseNumber(entry.name) }))
        .sort((a, b) => a.order - b.order || a.phase.localeCompare(b.phase))
    : [];
  const others = [
    { file: path.join(root, "docs", "operator", "todo.md"), phase: "operator", order: -1 },
    { file: path.join(root, "docs", "build", "backlog.md"), phase: "backlog", order: Infinity },
  ];
  return [...phases, ...others.filter((source) => existsSync(source.file))];
}

export function normalisePath(p) {
  return p.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function touchList(value) {
  const ticked = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  return (ticked.length ? ticked : value.split(","))
    .map(normalisePath)
    .filter((p) => p && !/^(none|n\/a|-)$/i.test(p));
}

export function parseItems(text, { file = "", phase = "", order = 0 } = {}) {
  const items = [];
  let iteration = null;
  let current = null;
  let fenced = false;
  for (const [index, line] of text.replace(/\r\n/g, "\n").split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced; // examples inside code blocks are not real items
      current = null;
      continue;
    }
    if (fenced) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      iteration = /^iteration\b/i.test(heading[1]) ? heading[1].trim() : null;
      current = null;
      continue;
    }
    const item = line.match(ITEM_LINE);
    if (item) {
      const [, , mark, id, rest] = item;
      const tag = rest.match(/`([^`]*)`\s*$/);
      current = {
        id,
        status: STATUS[mark],
        title: (tag ? rest.slice(0, tag.index) : rest).trim(),
        tag: tag ? tag[1] : "",
        depends: [],
        touches: [],
        claimed: "",
        blocked: "",
        file,
        phase,
        order,
        iteration,
        line: index + 1,
        text: [line],
      };
      items.push(current);
      continue;
    }
    if (!current) continue;
    if (/^\s+\S/.test(line)) current.text.push(line);
    const field = line.match(FIELD_LINE);
    if (field) {
      const [, name, value] = field;
      if (name === "Depends") current.depends = value.match(ITEM_ID) ?? [];
      else if (name === "Touches") current.touches = touchList(value);
      else current[name.toLowerCase()] = value.trim();
    } else if (line.trim() && !/^\s/.test(line)) {
      current = null; // an unindented line ends the item
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Claims: one JSON file shared by every worktree of the repo
// ---------------------------------------------------------------------------

export function claimsFile(root) {
  const git = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" });
  if (git.status === 0 && git.stdout.trim()) return path.join(path.resolve(root, git.stdout.trim()), "agent-ready", "claims.json");
  return path.join(root, ".agents", "claims.json");
}

function git(cwd, ...args) {
  const out = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: out.status === 0, out: (out.stdout ?? "").trim(), err: (out.stderr ?? "").trim() || String(out.error?.message ?? "") };
}

// The checkout an agent works in: the git top folder of this worktree, or the
// project folder when there is no git. Claims record it, so the guard can tell
// one agent's checkout from another's.
export function checkoutRoot(dir) {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return path.resolve(top.ok && top.out ? top.out : dir);
}

function isLinkedWorktree(dir) {
  const dirs = git(dir, "rev-parse", "--git-dir", "--git-common-dir");
  if (!dirs.ok) return false;
  const [own, common] = dirs.out.split(/\r?\n/).map((p) => path.resolve(dir, p));
  return own !== common;
}

export function loadConfig(root) {
  let file = {};
  try {
    file = JSON.parse(readFileSync(path.join(root, ".agents", "board.json"), "utf8"));
  } catch {}
  return {
    mainBranch: file.mainBranch || "main",
    worktreeDir: file.worktreeDir || `../${path.basename(root)}-worktrees`,
    maxBuilders: Number(file.maxBuilders) > 0 ? Number(file.maxBuilders) : 3,
    checks: Array.isArray(file.checks) ? file.checks.filter((check) => typeof check === "string" && check.trim()) : [],
  };
}

function readClaims(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Only one agent at a time may change the claims file.
function withLock(file, change) {
  mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const giveUpAt = Date.now() + 5000;
  for (;;) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 30_000) unlinkSync(lock); // left behind by a crash
      } catch {}
      if (Date.now() > giveUpAt) throw new Error("Another agent is changing the claims right now. Try again in a moment.");
      pause(50);
    }
  }
  try {
    return change();
  } finally {
    try {
      unlinkSync(lock);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// What the board knows
// ---------------------------------------------------------------------------

export function loadBoard(root) {
  const items = sourceFiles(root).flatMap((source) =>
    parseItems(readFileSync(source.file, "utf8"), { ...source, file: path.relative(root, source.file).split(path.sep).join("/") }),
  );
  return { root, items, claims: readClaims(claimsFile(root)) };
}

const isPhaseItem = (item) => item.order >= 0 && item.order !== Infinity;

export function currentPhase(board) {
  const open = board.items.find((item) => isPhaseItem(item) && ["todo", "doing", "blocked"].includes(item.status));
  return open ? open.phase : null;
}

// Two paths overlap when one is the other, or one is inside the other. A glob
// counts as the folder it starts in, so `src/auth*` overlaps all of `src/`.
// Square brackets are left alone: frameworks use them in real folder names
// (`app/[id]/page.tsx`).
function scope(p) {
  const wild = p.search(/[*?{]/);
  const fixed = wild === -1 ? p : p.slice(0, wild).replace(/[^/]*$/, "");
  return fixed.replace(/\/+$/, "").toLowerCase();
}

export function pathsOverlap(a, b) {
  const x = scope(normalisePath(a));
  const y = scope(normalisePath(b));
  if (!x || !y) return true;
  return x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`);
}

function sharedPaths(a, b) {
  return a.filter((p) => b.some((q) => pathsOverlap(p, q)));
}

// Everything someone is working on: claims made with the board, plus items
// marked [~] in a plan.
export function activeWork(board) {
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const active = new Map();
  for (const item of board.items) {
    // "**Claimed:** codex-1, 2026-10-17 10:00, <worktree>": the name comes first.
    // Marked [~] with no claim on the board means paused: someone stopped
    // partway and released it. Its partial work still holds its files.
    if (item.status === "doing") {
      const [agent, , where] = item.claimed.split(",").map((part) => part.trim());
      active.set(item.id, { id: item.id, agent: agent || "someone", at: null, touches: item.touches, where: where || null, paused: true });
    }
  }
  for (const [id, claim] of Object.entries(board.claims)) {
    active.set(id, { id, agent: claim.agent, at: claim.at, touches: claim.touches ?? byId.get(id)?.touches ?? [], where: claim.root ?? null, paused: false });
  }
  return [...active.values()];
}

// Items someone stopped partway: in progress or blocked in the plan, with no
// claim on the board. Anyone may pick these up with resume.
export function pausedItems(board) {
  return board.items.filter((item) => isPhaseItem(item) && ["doing", "blocked"].includes(item.status) && !board.claims[item.id]);
}

// Why an item cannot be started now. An empty list means it is ready.
export function blockers(board, item) {
  const byId = new Map(board.items.map((other) => [other.id, other]));
  const reasons = [];
  if (!isPhaseItem(item)) reasons.push(item.phase === "operator" ? "it is an operator to-do" : "it is in the backlog, not in a phase plan");
  else if (item.phase !== currentPhase(board)) reasons.push(`it is in ${item.phase}, and the current phase is ${currentPhase(board) ?? "finished"}`);
  if (["doing", "blocked"].includes(item.status) && !board.claims[item.id]) reasons.push(`it is paused work someone stopped partway; pick it up with: resume ${item.id} --agent <your name>`);
  else if (item.status !== "todo") reasons.push(`it is marked ${item.status}`);
  if (board.claims[item.id]) reasons.push(`${board.claims[item.id].agent} has claimed it`);
  for (const id of item.depends) {
    const dependency = byId.get(id);
    if (!dependency) reasons.push(`it depends on ${id}, which is not in any plan`);
    else if (dependency.status === "dropped") reasons.push(`it depends on ${id}, which was dropped`);
    else if (dependency.status !== "done") reasons.push(`it waits on ${id} (${dependency.status})`);
  }
  if (!item.touches.length) reasons.push("it has no Touches line, so overlaps cannot be checked");
  for (const work of activeWork(board)) {
    if (work.id === item.id) continue;
    const shared = sharedPaths(item.touches, work.touches);
    if (shared.length) reasons.push(`${work.agent} is working on ${work.id}, which touches the same files (${shared.join(", ")})`);
  }
  return reasons;
}

export function readyItems(board) {
  return board.items.filter((item) => isPhaseItem(item) && item.status === "todo" && blockers(board, item).length === 0);
}

function findCycles(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const state = new Map(); // 1 = on the current path, 2 = finished
  const cycles = [];
  const visit = (id, trail) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      cycles.push([...trail.slice(trail.indexOf(id)), id].join(" -> "));
      return;
    }
    state.set(id, 1);
    for (const next of byId.get(id)?.depends ?? []) if (byId.has(next)) visit(next, [...trail, id]);
    state.set(id, 2);
  };
  for (const item of items) visit(item.id, []);
  return cycles;
}

// Problems make `check` fail. Warnings are worth a look but do not.
export function review(board, now = new Date()) {
  const problems = [];
  const warnings = [];
  const seen = new Map();
  for (const item of board.items) {
    const where = `${item.file}:${item.line}`;
    if (seen.has(item.id)) problems.push(`${item.id} is used twice: ${seen.get(item.id)} and ${where}. IDs must be unique.`);
    else seen.set(item.id, where);
  }
  const byId = new Map(board.items.map((item) => [item.id, item]));
  for (const item of board.items.filter(isPhaseItem)) {
    for (const id of item.depends) {
      const dependency = byId.get(id);
      if (!dependency) problems.push(`${item.id} depends on ${id}, which is not in any plan, the backlog or the to-do list.`);
      else if (dependency.order > item.order) problems.push(`${item.id} depends on ${id}, which is in ${dependency.phase}. Items may only depend on the same or an earlier phase.`);
      else if (dependency.file === item.file && dependency.iteration && dependency.iteration === item.iteration)
        problems.push(`${item.id} depends on ${id} in the same iteration (${item.iteration}). Move one of them, so each iteration can be built in parallel.`);
    }
  }
  for (const cycle of findCycles(board.items)) problems.push(`Dependencies go round in a circle: ${cycle}. Pull the shared piece out into its own item.`);
  const active = activeWork(board);
  for (const [i, a] of active.entries()) {
    for (const b of active.slice(i + 1)) {
      const shared = sharedPaths(a.touches, b.touches);
      if (shared.length) problems.push(`${a.id} (${a.agent}) and ${b.id} (${b.agent}) are both in progress and touch the same files: ${shared.join(", ")}.`);
    }
  }
  for (const [id, claim] of Object.entries(board.claims)) {
    const item = byId.get(id);
    if (!item) warnings.push(`${claim.agent} claimed ${id}, which is no longer in any plan. Release it.`);
    else if (["done", "dropped"].includes(item.status)) warnings.push(`${id} is ${item.status} but still claimed by ${claim.agent}. Release it.`);
    else if (now - new Date(claim.at) > STALE_AFTER_MS) warnings.push(`${claim.agent} claimed ${id} ${ago(claim.at, now)} ago. If nothing has moved, it is stale: check, write a handoff, then release it.`);
  }
  return { problems, warnings };
}

function ago(iso, now = new Date()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

export function summary(board, now = new Date()) {
  const phase = currentPhase(board);
  const inPhase = board.items.filter((item) => item.phase === phase);
  const done = inPhase.filter((item) => item.status === "done").length;
  const counted = inPhase.filter((item) => item.status !== "dropped").length;
  const ready = readyItems(board);
  const readyIds = new Set(ready.map((item) => item.id));
  const active = activeWork(board);
  const activeIds = new Set(active.map((work) => work.id));
  const paused = pausedItems(board);
  const pausedIds = new Set(paused.map((item) => item.id));
  return {
    phase,
    progress: { done, of: counted },
    ready: ready.map(({ id, title, touches }) => ({ id, title, touches })),
    doing: active.filter((work) => !work.paused).map((work) => ({ ...work, since: work.at ? ago(work.at, now) : null })),
    paused: paused.map((item) => ({ id: item.id, title: item.title, by: item.claimed.split(",")[0].trim() || null, blocked: item.status === "blocked" ? item.blocked || "marked blocked" : null, handoffs: handoffsFor(board.root, item.id) })),
    waiting: inPhase
      .filter((item) => ["todo", "blocked"].includes(item.status) && !readyIds.has(item.id) && !activeIds.has(item.id) && !pausedIds.has(item.id))
      .map((item) => ({ id: item.id, title: item.title, why: item.status === "blocked" && item.blocked ? [item.blocked] : blockers(board, item) })),
    operator: board.items.filter((item) => item.phase === "operator" && item.status === "todo").map(({ id, title }) => ({ id, title })),
    ...review(board, now),
  };
}

function printSummary(s) {
  const lines = [];
  lines.push(s.phase ? `Current phase: ${s.phase} (${s.progress.done} of ${s.progress.of} done)` : "No open phase. Every planned item is done or dropped.");
  const section = (title, rows) => {
    lines.push("", `${title} (${rows.length}):`);
    if (!rows.length) lines.push("  none");
    for (const row of rows) lines.push(`  ${row}`);
  };
  section("Ready now", s.ready.map((item) => `${item.id}  ${item.title}  [${item.touches.join(", ")}]`));
  section("In progress", s.doing.map((work) => `${work.id}  ${work.agent}${work.since ? `, ${work.since} ago` : ""}${work.where ? `, in ${work.where}` : ""}  [${work.touches.join(", ")}]`));
  if (s.paused.length)
    section(
      "Paused (stopped partway; pick up with resume <id> --agent <name>)",
      s.paused.map((item) => `${item.id}  ${item.title}${item.by ? `, last worked on by ${item.by}` : ""}${item.blocked ? `; blocked: ${item.blocked}` : ""}${item.handoffs.length ? `; read first: ${item.handoffs.join(", ")}` : ""}`),
    );
  section("Waiting", s.waiting.map((item) => `${item.id}  ${item.title}: ${item.why.join("; ")}`));
  section("Waiting on the operator", s.operator.map((item) => `${item.id}  ${item.title}`));
  section("Problems", s.problems);
  if (s.warnings.length) section("Warnings", s.warnings);
  return lines.join("\n");
}

// Handoff notes that mention an item: named after it, or naming it inside.
function handoffsFor(root, id) {
  const dir = path.join(root, "docs", "build", "handoffs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => name.includes(id) || new RegExp(`\\b${id}\\b`).test(readFileSync(path.join(dir, name), "utf8")))
    .map((name) => `docs/build/handoffs/${name}`);
}

// ---------------------------------------------------------------------------
// Claiming, releasing and resuming
// ---------------------------------------------------------------------------

// `workRoot` is the checkout the work will happen in. It defaults to this one;
// `start` passes the new worktree.
export function claim(root, id, agent, now = new Date(), { workRoot } = {}) {
  if (!agent) return { ok: false, message: "Say who is claiming it: claim <id> --agent <name>." };
  const file = claimsFile(root);
  return withLock(file, () => {
    const board = loadBoard(root);
    const item = board.items.find((candidate) => candidate.id === id);
    if (!item) return { ok: false, message: `There is no item ${id} in the plans.` };
    const reasons = blockers(board, item);
    if (reasons.length) return { ok: false, message: `${id} cannot be claimed: ${reasons.join("; ")}.` };
    const claims = readClaims(file);
    claims[id] = { agent, at: now.toISOString(), touches: item.touches, root: workRoot ? path.resolve(workRoot) : checkoutRoot(root) };
    writeFileSync(file, `${JSON.stringify(claims, null, 2)}\n`);
    return {
      ok: true,
      item,
      message: [
        `${agent} now holds ${id}: ${item.title}`,
        `Touches: ${item.touches.join(", ")}`,
        `When it is done, or if you stop: node .agents/scripts/board.mjs release ${id}`,
      ].join("\n"),
    };
  });
}

export function release(root, id) {
  const file = claimsFile(root);
  return withLock(file, () => {
    const claims = readClaims(file);
    if (!claims[id]) return { ok: true, message: `${id} was not claimed. Nothing to release.` };
    const { agent } = claims[id];
    delete claims[id];
    writeFileSync(file, `${JSON.stringify(claims, null, 2)}\n`);
    const item = loadBoard(root).items.find((candidate) => candidate.id === id);
    const paused = item && ["doing", "blocked"].includes(item.status);
    return {
      ok: true,
      message: paused
        ? `Released ${id} (was held by ${agent}). It is still marked [${item.status === "doing" ? "~" : "!"}] in its plan, so it shows as paused work: anyone can pick it up, with its partial work, using resume ${id} --agent <name>. If the work is abandoned instead, mark it [ ] or [-] in the plan.`
        : `Released ${id} (was held by ${agent}).`,
    };
  });
}

// Pick up an item someone stopped partway, keeping its partial work, branch,
// worktree and handoff. Allowed when the item is paused (no claim), when you
// already hold it (a new session), or, with takeOver, when the holder's claim
// is stale. A fresh claim by someone else is never taken.
export function resume(root, id, agent, now = new Date(), { takeOver = false } = {}) {
  if (!agent) return fail("Say who is picking it up: resume <id> --agent <name>.");
  const file = claimsFile(root);
  const result = withLock(file, () => {
    const board = loadBoard(root);
    const item = board.items.find((candidate) => candidate.id === id);
    if (!item) return fail(`There is no item ${id} in the plans.`);
    if (!isPhaseItem(item)) return fail(`${id} is not in a phase plan, so there is nothing to resume.`);
    const held = board.claims[id];
    if (!held && !["doing", "blocked"].includes(item.status)) return fail(`${id} is marked ${item.status}, not in progress, so there is nothing to resume. To start it, use: claim ${id} --agent ${agent}`);
    if (held && held.agent !== agent) {
      const age = ago(held.at, now);
      if (now - new Date(held.at) <= STALE_AFTER_MS) return fail(`${held.agent} is working on ${id} (claimed ${age} ago), so it can't be taken over. Leave it, or ask ${held.agent} or the operator: only they should release it.`);
      if (!takeOver) return fail(`${held.agent} claimed ${id} ${age} ago and nothing has moved, so the claim is stale. Read its handoff and look at its work first, then take it over with: resume ${id} --agent ${agent} --take-over`);
    }
    const byId = new Map(board.items.map((other) => [other.id, other]));
    const waiting = item.depends.filter((dep) => byId.get(dep)?.status !== "done");
    if (waiting.length) return fail(`${id} waits on ${waiting.join(", ")}, which ${waiting.length > 1 ? "are" : "is"} not done any more. Sort that out first.`);
    for (const work of activeWork(board)) {
      if (work.id === id) continue;
      const shared = sharedPaths(item.touches, work.touches);
      if (shared.length) return fail(`${work.agent} is working on ${work.id}, which touches the same files (${shared.join(", ")}). Wait for it, or ask the operator.`);
    }
    const recorded = [held?.root, item.claimed.split(",")[2]?.trim()].find((place) => place && existsSync(place));
    const workRoot = recorded ? path.resolve(recorded) : checkoutRoot(root);
    const previous = held?.agent ?? (item.claimed.split(",")[0].trim() || null);
    const claims = readClaims(file);
    claims[id] = { agent, at: now.toISOString(), touches: item.touches, root: workRoot };
    writeFileSync(file, `${JSON.stringify(claims, null, 2)}\n`);
    return { ok: true, item, workRoot, previous };
  });
  if (!result.ok) return result;

  const { item, workRoot, previous } = result;
  const handedOver = previous && previous !== agent ? `, picked up from ${previous}` : "";
  updateItem(path.join(root, item.file), id, { mark: "~", drop: ["Claimed", "Blocked"], add: [`- **Claimed:** ${agent}, ${stamp(now)}, ${workRoot}${handedOver}`] });
  const branch = `agent/${id}`;
  const onBranch = git(root, "rev-parse", "--verify", branch).ok ? git(root, "rev-list", "--count", `${loadConfig(root).mainBranch}..${branch}`).out : null;
  const notes = handoffsFor(root, id);
  return {
    ok: true,
    message: [
      `${agent} has picked up ${id}: ${item.title}${handedOver}.`,
      `Work on it in ${workRoot}.${onBranch !== null ? ` Its branch ${branch} has ${onBranch} commit${onBranch === "1" ? "" : "s"} so far.` : ""} Partial work there is kept as it is: start with git status.`,
      item.blocked ? `It was blocked: ${item.blocked}. Check that this is solved before carrying on.` : "",
      notes.length ? `Read first: ${notes.join(", ")}` : "No handoff note mentions it, so check the item's plan entry and git log for what was done.",
      `Touches: ${item.touches.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Editing an item in its plan: the mark, and its field lines
// ---------------------------------------------------------------------------

export function updateItem(file, id, { mark, drop = [], add = [] } = {}) {
  const text = readFileSync(file, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => {
    const match = line.match(ITEM_LINE);
    return match && match[3] === id;
  });
  if (at === -1) return false;
  const indent = lines[at].match(/^\s*/)[0];
  if (mark) lines[at] = lines[at].replace(/- \[[ xX~!-]\]/, `- [${mark}]`);
  let end = at;
  while (end + 1 < lines.length && /^\s+\S/.test(lines[end + 1]) && lines[end + 1].match(/^\s*/)[0].length > indent.length) end++;
  const fieldIs = (line, name) => new RegExp(`^\\s+- \\*\\*${name}:\\*\\*`).test(line);
  const kept = lines.slice(at + 1, end + 1).filter((line) => !drop.some((name) => fieldIs(line, name)));
  lines.splice(at + 1, end - at, ...kept, ...add.map((line) => `${indent}  ${line}`));
  writeFileSync(file, lines.join(eol));
  return true;
}

// ---------------------------------------------------------------------------
// Parallel mode: picking a batch, starting a builder, merging its branch
// ---------------------------------------------------------------------------

export function nextBatch(board, max) {
  const active = activeWork(board).length;
  const room = Math.max(0, max - active);
  const picked = [];
  for (const item of readyItems(board)) {
    if (picked.length >= room) break;
    if (picked.some((other) => sharedPaths(other.touches, item.touches).length)) continue;
    picked.push(item);
  }
  return { picked, active, room };
}

const fail = (message) => ({ ok: false, message });

function stamp(now) {
  return now.toISOString().slice(0, 16).replace("T", " ");
}

function needsMainCheckout(root, config) {
  if (!git(root, "rev-parse", "--show-toplevel").ok) return "Parallel mode needs a git repo. Ask the operator to set one up (it can go on their to-do list).";
  if (!git(root, "rev-parse", "--verify", "HEAD").ok) return "Parallel mode needs at least one save point (commit) to branch from. Ask the operator.";
  if (isLinkedWorktree(root)) return "Run this from the main checkout, not from inside a builder's worktree.";
  const branch = git(root, "rev-parse", "--abbrev-ref", "HEAD").out;
  if (branch !== config.mainBranch) return `The main checkout is on "${branch}", not "${config.mainBranch}". Switch back first, or set mainBranch in .agents/board.json.`;
  return null;
}

export function start(root, id, agent, now = new Date()) {
  if (!agent) return fail("Say who the builder is: start <id> --agent <name>.");
  const config = loadConfig(root);
  const problem = needsMainCheckout(root, config);
  if (problem) return fail(problem);
  const worktree = path.resolve(root, config.worktreeDir, id);
  if (existsSync(worktree)) return fail(`${worktree} already exists. Remove the old worktree first (git worktree remove "${worktree}").`);
  const claimed = claim(root, id, agent, now, { workRoot: worktree });
  if (!claimed.ok) return claimed;
  const added = git(root, "worktree", "add", worktree, "-b", `agent/${id}`, config.mainBranch);
  if (!added.ok) {
    release(root, id);
    return fail(`Could not make the worktree, so the claim was released: ${added.err}`);
  }
  const item = claimed.item;
  updateItem(path.join(root, item.file), id, { mark: "~", drop: ["Claimed"], add: [`- **Claimed:** ${agent}, ${stamp(now)}, ${worktree}`] });
  const brief = [
    `You are a builder on this project. Work only in ${worktree}, on branch agent/${id}, on this one item:`,
    "",
    ...item.text,
    "",
    "Read AGENTS.md first, then the builder rules in docs/rules/parallel.md.",
    `Change only the files under Touches. Commit to your branch as you go. Never merge, never push, and leave the shared files alone.`,
    `When it is done: copy docs/build/templates/handoff.md to docs/build/handoffs/${id}.md, fill it in, commit it, and say "${id} is ready to merge".`,
  ];
  return {
    ok: true,
    message: [`Started ${id} for ${agent}.`, `Worktree: ${worktree} (branch agent/${id})`, "", `Brief for ${agent}:`, "---", ...brief, "---"].join("\n"),
  };
}

function runChecks(cwd, checks) {
  for (const command of checks) {
    const run = spawnSync(command, { cwd, shell: true, encoding: "utf8" });
    if (run.status !== 0) {
      const tail = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split(/\r?\n/).slice(-15).join("\n");
      return { ok: false, command, tail };
    }
  }
  return { ok: true };
}

// Save points on the main line, newest first: { sha, parents, subject, body }.
function mainLine(root, ref = "HEAD") {
  const log = git(root, "log", "--first-parent", "--format=%H%x1f%P%x1f%s%x1f%b%x1e", ref);
  if (!log.ok) return [];
  return log.out
    .split("\x1e")
    .map((record) => record.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((record) => {
      const [sha, parents, subject, body = ""] = record.split("\x1f");
      return { sha, parents: parents.split(" ").filter(Boolean), subject, body };
    });
}

// The save points on the line that are undone right now, each mapped to the
// revert that undoes it. A commit is undone when a revert of it is itself still
// in effect, so an undo that was reversed again (a revert of the revert) leaves
// the commit in effect. Reverts are found by git's standard "This reverts
// commit <sha>" line.
function undoneOnLine(records) {
  const revertedBy = new Map();
  for (const r of records) {
    for (const [, target] of r.body.matchAll(/This reverts commit ([0-9a-f]{7,40})/g)) {
      const hit = records.find((other) => other.sha.startsWith(target));
      if (hit) revertedBy.set(hit.sha, [...(revertedBy.get(hit.sha) ?? []), r.sha]);
    }
  }
  // Newest first, so every revert of a commit is decided before the commit.
  const undone = new Map();
  for (const r of records) {
    const by = (revertedBy.get(r.sha) ?? []).find((revert) => !undone.has(revert));
    if (by) undone.set(r.sha, by);
  }
  return undone;
}

const isAncestor = (root, commit, of) => git(root, "merge-base", "--is-ancestor", commit, of).ok;

// The item's work that a failed merge took off main and its branch has not
// brought back yet, as { merge, revert }. Only the item's own newest merge
// counts, and only while the revert that undid it is in effect, so a later
// good merge of it ends the recovery and other items' merges never start one.
// The recovery is pending when the plan has rollBack's "Merge undone" note for
// that merge or, if the note was lost, when the branch holds the merged work
// but not the merge (only the item's own branch does). An item undone on
// purpose with undo has neither, so building it again brings nothing back.
function undoneMerge(root, item, branch, mainBranch) {
  const records = mainLine(root, mainBranch);
  const latest = records.find((r) => r.parents.length > 1 && r.subject.startsWith(`merge(${item.id}):`));
  const revert = latest && undoneOnLine(records).get(latest.sha);
  if (!revert) return null;
  const noted = item.text.some((line) => /\*\*Merge undone:\*\*/.test(line) && line.includes(latest.sha.slice(0, 7)));
  const holdsWorkOnly = isAncestor(root, latest.parents[1], branch) && !isAncestor(root, latest.sha, branch);
  if (!noted && !holdsWorkOnly) return null;
  const broughtBack = git(root, "log", "--format=%b", `${mainBranch}..${branch}`).out.includes(`This reverts commit ${revert}`);
  return broughtBack ? null : { merge: latest.sha, revert };
}

// Bring the undone work back onto the branch: in the worktree, revert the
// revert on top of main (leaving the plan out, which the merge ticks itself),
// then move the branch's own new commits on top. This works whether or not the
// builder rebased onto main after the undo, and the commit it adds marks the
// work as brought back, so it is never done twice. Nothing changes on main.
function bringBack(worktree, branch, mainBranch, undone, planFile) {
  const short = (sha) => sha.slice(0, 7);
  // The worktree was clean before this started, so going back to the branch
  // as it was only drops what this step did.
  const failed = (why) => {
    git(worktree, "rebase", "--abort");
    git(worktree, "revert", "--abort");
    git(worktree, "checkout", "-q", "-f", branch);
    return fail(
      [
        `${branch} was merged before as ${short(undone.merge)}, and that merge was undone by ${short(undone.revert)} because the checks failed. Bringing that work back onto the branch hit a problem, so nothing was changed: ${why}`,
        `Send it back to the builder. In the worktree: git checkout --detach ${mainBranch}, then git revert --no-edit ${short(undone.revert)}, then git rebase --onto HEAD ${mainBranch} ${branch}, and resolve. Then run merge again.`,
      ].join("\n"),
    );
  };
  if (!git(worktree, "checkout", "-q", "--detach", mainBranch).ok) return failed(`could not check out ${mainBranch} in the worktree.`);
  // The plan is left as main has it, so a clash there alone (another item's
  // tick next to this one's) is no clash. Any other clash stops it.
  const reverted = git(worktree, "revert", "--no-commit", undone.revert);
  if (!reverted.ok) {
    const clashes = git(worktree, "diff", "--name-only", "--diff-filter=U").out.split(/\r?\n/).filter(Boolean);
    if (!clashes.length || clashes.some((file) => file !== planFile)) return failed(reverted.err);
  }
  if (git(worktree, "cat-file", "-e", `HEAD:${planFile}`).ok) git(worktree, "checkout", "HEAD", "--", planFile);
  const saved = git(worktree, "commit", "-q", "--no-edit", "--cleanup=strip");
  if (!saved.ok) return failed(saved.err);
  const replayed = git(worktree, "rebase", "--onto", git(worktree, "rev-parse", "HEAD").out, mainBranch, branch);
  if (!replayed.ok) return failed(replayed.err || "the branch's own commits clash with the work being brought back.");
  return { ok: true };
}

// Files with uncommitted changes. The status letters are stripped by pattern,
// not by position, because the output arrives trimmed.
function changedFiles(root, except = []) {
  return git(root, "status", "--porcelain")
    .out.split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.replace(/^[ MADRCUT?!]{1,2}\s/, "").split(" -> ").pop().trim())
    .filter((file) => !except.includes(file));
}

// The merge broke main. Undo it with a revert, verify the result, and leave a
// truthful, recoverable state whether or not the undo worked.
function rollBack({ root, config, item, branch, worktree, claim: held, before, check, now }) {
  const id = item.id;
  const planFile = path.join(root, item.file);
  const merged = git(root, "rev-parse", "HEAD").out;
  const why = `"${check.command}" fails on ${config.mainBranch} after merging ${id}`;
  const reverted = git(root, "revert", "-m", "1", "--no-edit", merged);

  if (!reverted.ok) {
    const inProgress = git(root, "rev-parse", "--git-path", "REVERT_HEAD").out;
    if (inProgress && existsSync(path.resolve(root, inProgress))) git(root, "revert", "--abort");
    const left = changedFiles(root, [item.file]);
    updateItem(planFile, id, {
      mark: "!",
      drop: ["Done", "Blocked"],
      add: [`- **Blocked:** merged as ${merged.slice(0, 7)} on ${now.toISOString().slice(0, 10)}, but the checks failed on ${config.mainBranch} and the merge could not be undone automatically. It is not done.`],
    });
    return fail(
      [
        `${why}. Undoing the merge failed too, so the merge is still in place: ${config.mainBranch} is at ${merged.slice(0, 7)}.`,
        `Why the undo failed: ${reverted.err || "git revert gave no reason"}`,
        left.length ? `Files changed since the merge, kept exactly as they are: ${left.join(", ")}` : "",
        `${id} is marked blocked [!] in ${item.file}, not done. Its claim, the branch ${branch} and the worktree ${worktree} are kept.`,
        `Next: look at those changes and keep or drop them yourself, then either fix ${config.mainBranch}, or undo the merge with: git revert -m 1 ${merged.slice(0, 7)}`,
        check.tail,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const revert = git(root, "rev-parse", "HEAD").out;
  const restored = git(root, "diff", "--quiet", before, revert).ok;
  // The revert also put the plan back as it was before the merge. Mark the item
  // in progress again, for the same builder, so the board shows the truth.
  updateItem(planFile, id, {
    mark: "~",
    drop: ["Claimed", "Done", "Blocked"],
    add: [
      `- **Claimed:** ${held?.agent ?? "its builder"}, ${stamp(held?.at ? new Date(held.at) : now)}, ${worktree}`,
      `- **Merge undone:** ${now.toISOString().slice(0, 10)}. The checks failed on ${config.mainBranch}; ${revert.slice(0, 7)} reverts ${merged.slice(0, 7)}.`,
    ],
  });
  const left = changedFiles(root, [item.file]);
  return fail(
    [
      `${why}, so the merge was undone: ${revert.slice(0, 7)} reverts ${merged.slice(0, 7)}.`,
      restored ? `${config.mainBranch} is back exactly as it was before the merge (checked).` : `The revert went through, but ${config.mainBranch} does not match how it was before the merge. Compare with: git diff ${before.slice(0, 7)} HEAD`,
      left.length ? `The check also changed these files, kept as they are: ${left.join(", ")}` : "",
      `${id} is back in progress for ${held?.agent ?? "its builder"}, in ${worktree} on ${branch}. The claim is kept.`,
      `Next: fix the problem on ${branch}, commit, and run merge again. That merge brings back everything from this one, not just the fix.`,
      check.tail,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function merge(root, id, now = new Date()) {
  const config = loadConfig(root);
  const problem = needsMainCheckout(root, config);
  if (problem) return fail(problem);
  const board = loadBoard(root);
  const item = board.items.find((candidate) => candidate.id === id);
  if (!item) return fail(`There is no item ${id} in the plans.`);
  const claimRecord = board.claims[id];
  const branch = `agent/${id}`;
  const worktree = claimRecord?.root;
  if (!git(root, "rev-parse", "--verify", branch).ok) return fail(`There is no branch ${branch}. Was it started with: board.mjs start ${id}?`);
  if (!worktree || !existsSync(worktree) || path.resolve(worktree) === checkoutRoot(root)) return fail(`${id} has no worktree of its own, so it cannot be merged this way.`);

  const byId = new Map(board.items.map((other) => [other.id, other]));
  const waiting = item.depends.filter((dep) => byId.get(dep)?.status !== "done");
  if (waiting.length) return fail(`Merge ${waiting.join(", ")} first: ${id} depends on ${waiting.length > 1 ? "them" : "it"}.`);
  if (git(worktree, "status", "--porcelain").out) return fail(`The builder left uncommitted changes in ${worktree}. They must commit or drop them first.`);

  // 0. If this item's last merge was undone, its commits are still reachable
  // from main, so git would count them as merged and leave them out. Bring the
  // work back onto the branch first, so this merge includes all of it.
  const notes = [];
  const undone = undoneMerge(root, item, branch, config.mainBranch);
  if (undone) {
    const back = bringBack(worktree, branch, config.mainBranch, undone, item.file);
    if (!back.ok) return back;
    notes.push(`Brought back the work from the undone merge ${undone.merge.slice(0, 7)} by reversing its undo on ${branch}, so this merge includes all of it, not just the fix.`);
  }
  if (git(root, "rev-list", "--count", `${config.mainBranch}..${branch}`).out === "0") return fail(`${branch} has no commits yet. Nothing to merge.`);

  // 1. Bring the branch up to date with main, in its own worktree.
  const rebased = git(worktree, "rebase", config.mainBranch);
  if (!rebased.ok) {
    const conflicts = git(worktree, "diff", "--name-only", "--diff-filter=U").out.split(/\r?\n/).filter(Boolean);
    git(worktree, "rebase", "--abort");
    return fail(`${branch} conflicts with ${config.mainBranch}${conflicts.length ? ` in ${conflicts.join(", ")}` : ""}. Nothing was changed. Send it back to the builder to rebase and resolve.`);
  }

  // 2. The branch must pass the checks on its own.
  const onBranch = runChecks(worktree, config.checks);
  if (!onBranch.ok) return fail(`"${onBranch.command}" fails on ${branch}, so it was not merged. Send it back to the builder:\n${onBranch.tail}`);

  // 3. Merge, and record the item as done in the same commit.
  const before = git(root, "rev-parse", "HEAD").out;
  const merging = git(root, "merge", "--no-ff", "--no-commit", branch);
  if (!merging.ok) {
    git(root, "merge", "--abort");
    return fail(`git could not merge ${branch}: ${merging.err}`);
  }
  updateItem(path.join(root, item.file), id, {
    mark: "x",
    drop: ["Claimed", "Blocked", "Merge undone"],
    add: [`- **Done:** ${now.toISOString().slice(0, 10)}. Merged from ${branch}. Report: \`docs/build/handoffs/${id}.md\`.`],
  });
  git(root, "add", "--", item.file);
  const committed = git(root, "commit", "-m", `merge(${id}): ${item.title}`);
  if (!committed.ok) {
    git(root, "merge", "--abort");
    return fail(`The merge commit failed, so nothing was merged: ${committed.err}`);
  }

  // 4. Main must still pass. If not, undo the merge with a new commit, check
  // that the undo really happened, and keep the claim and worktree either way.
  const onMain = runChecks(root, config.checks);
  if (!onMain.ok) return rollBack({ root, config, item, branch, worktree, claim: claimRecord, before, check: onMain, now });

  // 5. Clean up.
  release(root, id);
  const removed = git(root, "worktree", "remove", worktree);
  const deleted = git(root, "branch", "-d", branch);
  return {
    ok: true,
    message: [
      ...notes,
      `Merged ${id}: ${item.title}. It is ticked in ${item.file} and the claim is released.`,
      removed.ok ? `Removed the worktree ${worktree}.` : `Could not remove the worktree (${removed.err}). Remove it later with: git worktree remove "${worktree}"`,
      deleted.ok ? `Deleted the branch ${branch}.` : `Could not delete ${branch}: ${deleted.err}`,
      `Now copy the notes for the shared files from docs/build/handoffs/${id}.md (decisions, learnings, changelog, checks, to-dos) into those files.`,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Undo: go back to before an item, without rewriting history
// ---------------------------------------------------------------------------

const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The item's save points on the main line that are in effect now, newest
// first. Only first-parent history counts: in parallel mode the save point is
// the merge, and the builder's own commits inside it are not listed again. A
// save point whose undo was itself reversed is in effect again, so it is listed.
export function savePointsFor(root, id) {
  const records = mainLine(root);
  const undone = undoneOnLine(records);
  const names = new RegExp(`^[a-z]+\\([^)]*\\b${escapeForRegExp(id)}\\b[^)]*\\)!?:`, "i");
  return records.filter((r) => names.test(r.subject) && !undone.has(r.sha));
}

// Revert the item's save points, newest first, each once: a merge against its
// first parent (which undoes the whole merge), an ordinary commit as it is.
// Then reopen the item and run the checks. Without yes, only say what it would do.
export function undo(root, id, { yes = false, now = new Date() } = {}) {
  if (!git(root, "rev-parse", "--verify", "HEAD").ok) return fail("There are no save points yet, so there is nothing to undo.");
  if (isLinkedWorktree(root)) return fail("Run undo from the main checkout, not from inside a builder's worktree.");
  const targets = savePointsFor(root, id);
  if (!targets.length) return { ok: true, message: `Nothing to undo for ${id}: no save point on this branch names it, or it has been undone already.` };
  const listed = targets.map((r) => `  ${r.sha.slice(0, 7)}  ${r.subject}${r.parents.length > 1 ? "  (a merge: undone in one step, together with the builder's commits inside it)" : ""}`);
  if (!yes) {
    return {
      ok: true,
      message: [
        targets.length > 1 ? `Undoing ${id} would add ${targets.length} new commits that reverse these save points, newest first:` : `Undoing ${id} would add 1 new commit that reverses this save point:`,
        ...listed,
        "Nothing is deleted, and the undo can be undone too.",
        `To go ahead: node .agents/scripts/board.mjs undo ${id} --yes`,
      ].join("\n"),
    };
  }
  const dirty = changedFiles(root);
  if (dirty.length) return fail(`There are unsaved changes (${dirty.join(", ")}). Save them as a save point, or set them aside, before undoing, so the undo can't mix with them.`);

  const short = (sha) => sha.slice(0, 7);
  const reversals = [];
  const listReversals = () => reversals.map((r) => `${short(r.target)} by ${short(r.by)}`).join(", ");
  for (const r of targets) {
    const step = git(root, ...(r.parents.length > 1 ? ["revert", "--no-edit", "-m", "1", r.sha] : ["revert", "--no-edit", r.sha]));
    if (!step.ok) {
      const inProgress = git(root, "rev-parse", "--git-path", "REVERT_HEAD").out;
      if (inProgress && existsSync(path.resolve(root, inProgress))) git(root, "revert", "--abort");
      return fail(
        [
          `Undid ${reversals.length} of ${targets.length} save points for ${id}, then stopped: reversing ${short(r.sha)} (${r.subject}) clashes with later work, so it was left as it is.`,
          `git said: ${step.err}`,
          reversals.length ? `Already reversed: ${listReversals()}.` : "Nothing was changed.",
          "Later save points changed the same lines. Undo those first, or ask an agent to reverse it by hand.",
        ].join("\n"),
      );
    }
    reversals.push({ target: r.sha, by: git(root, "rev-parse", "HEAD").out });
  }

  // Reopen the item inside the last reversal, not in a commit of its own, so
  // that reverting the reversals brings back the work and the plan together.
  const board = loadBoard(root);
  const item = board.items.find((candidate) => candidate.id === id);
  let reopened = `${id} is not in any plan, so there was nothing to reopen.`;
  if (item) {
    updateItem(path.join(root, item.file), id, {
      mark: " ",
      drop: ["Done", "Claimed", "Blocked", "Merge undone", "Undone"],
      add: [`- **Undone:** ${now.toISOString().slice(0, 10)}, by reversing ${targets.map((r) => short(r.sha)).join(", ")}. Build it again, or mark it [-] with the reason if it is no longer wanted.`],
    });
    git(root, "add", "--", item.file);
    const saved = git(root, "commit", "--amend", "--no-edit");
    if (saved.ok) reversals.at(-1).by = git(root, "rev-parse", "HEAD").out;
    reopened = saved.ok ? `${id} is open again in ${item.file}.` : `${id} is marked open again in ${item.file}, but saving that change failed: ${saved.err}`;
  }
  if (board.claims[id]) release(root, id);
  const config = loadConfig(root);
  const checks = config.checks.length ? runChecks(root, config.checks) : null;
  return {
    ok: !checks || checks.ok,
    message: [
      `Undid ${id}: reversed ${listReversals()}.`,
      reopened,
      !checks ? "No checks are set in .agents/board.json, so run the item-done checks from AGENTS.md now." : checks.ok ? "The checks pass." : `"${checks.command}" fails after the undo. Nothing else was changed; look at it before carrying on:\n${checks.tail}`,
      `Nothing was deleted: git log still shows every save point. To bring ${id} back as it was: git revert --no-edit ${reversals.map((r) => short(r.by)).reverse().join(" ")}`,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// The graph
// ---------------------------------------------------------------------------

export function renderGraph(board, now = new Date()) {
  const node = (id) => id.replace(/[^a-z0-9]/gi, "_");
  const label = (item) => `${item.id}: ${item.title}`.replace(/["`]/g, "'").replace(/[[\]{}<>]/g, " ");
  const phaseItems = board.items.filter(isPhaseItem);
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const activeIds = new Set(activeWork(board).map((work) => work.id));
  const status = (item) => (activeIds.has(item.id) && item.status === "todo" ? "doing" : item.status);
  const out = ["graph LR"];
  for (const phase of [...new Set(phaseItems.map((item) => item.phase))]) {
    out.push(`  subgraph ${node(phase)}["${phase}"]`);
    for (const item of phaseItems.filter((candidate) => candidate.phase === phase)) out.push(`    ${node(item.id)}["${label(item)}"]:::${status(item)}`);
    out.push("  end");
  }
  const outside = new Set(phaseItems.flatMap((item) => item.depends).filter((id) => byId.has(id) && !isPhaseItem(byId.get(id))));
  for (const id of outside) out.push(`  ${node(id)}["${label(byId.get(id))}"]:::${byId.get(id).phase === "operator" ? "operator" : "backlog"}`);
  for (const item of phaseItems) for (const id of item.depends) if (byId.has(id)) out.push(`  ${node(id)} --> ${node(item.id)}`);
  out.push(
    "  classDef todo fill:#f2f4f7,stroke:#667085,color:#101828",
    "  classDef doing fill:#fef0c7,stroke:#dc6803,color:#7a2e0e",
    "  classDef blocked fill:#fee4e2,stroke:#d92d20,color:#7a271a",
    "  classDef done fill:#d1fadf,stroke:#039855,color:#054f31",
    "  classDef dropped fill:#ffffff,stroke:#98a2b3,color:#98a2b3,stroke-dasharray:4 4",
    "  classDef operator fill:#ebe9fe,stroke:#6938ef,color:#3e1c96",
    "  classDef backlog fill:#ffffff,stroke:#667085,color:#475467",
  );

  const phase = currentPhase(board);
  const touching = new Map();
  for (const item of phaseItems.filter((candidate) => candidate.phase === phase && !["done", "dropped"].includes(candidate.status))) {
    for (const p of item.touches) touching.set(p, [...(touching.get(p) ?? []), `${item.id} (${status(item)})`]);
  }
  const table = [...touching.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, ids]) => `| \`${p}\` | ${ids.join(", ")} |`);

  return `# Work graph

Made by \`node .agents/scripts/board.mjs graph\` on ${now.toISOString().slice(0, 10)}. Don't edit it by hand: run the command again.

Each arrow points from an item to the items waiting on it. Grey is to do, amber in progress, red blocked, green done, purple a to-do for the operator.

\`\`\`mermaid
${out.join("\n")}
\`\`\`

## Who touches what in ${phase ?? "the current phase"}

Open items only. Two items that share a path cannot be in progress at the same time.

| Path | Items |
| --- | --- |
${table.length ? table.join("\n") : "| (none) | |"}
`;
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

export function main(argv, { print = console.log, printError = console.error, cwd = process.cwd() } = {}) {
  const args = argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const positional = args.filter((arg, i) => !arg.startsWith("--") && !["--agent", "--root", "--max"].includes(args[i - 1]));
  const [command = "status", id] = positional;
  const root = valueOf("--root") ? path.resolve(cwd, valueOf("--root")) : findRoot(cwd);
  if (!root) {
    printError("No docs/build folder here or in any folder above. Run this from the project folder.");
    return 1;
  }
  const board = loadBoard(root);
  const json = args.includes("--json");
  try {
    switch (command) {
      case "status": {
        const s = summary(board);
        print(json ? JSON.stringify(s, null, 2) : printSummary(s));
        return 0;
      }
      case "ready": {
        const ready = readyItems(board);
        const paused = pausedItems(board);
        if (json) print(JSON.stringify({ ready, paused }, null, 2));
        else {
          const lines = paused.map((item) => `${item.id}  ${item.title}  (paused: pick it up first with resume ${item.id} --agent <your name>)`);
          lines.push(...ready.map((item) => `${item.id}  ${item.title}  [${item.touches.join(", ")}]`));
          print(lines.length ? lines.join("\n") : "Nothing is ready. Run the board with no command to see why.");
        }
        return 0;
      }
      case "check": {
        const { problems, warnings } = review(board);
        for (const warning of warnings) print(`warning: ${warning}`);
        if (problems.length) {
          for (const problem of problems) printError(`problem: ${problem}`);
          return 1;
        }
        print(`The plans look right: ${board.items.length} items checked.`);
        return 0;
      }
      case "claim":
      case "resume":
      case "release": {
        if (!id) {
          printError(`Which item? ${command} <id>${command === "release" ? "" : " --agent <name>"}`);
          return 1;
        }
        const result =
          command === "claim" ? claim(root, id, valueOf("--agent")) : command === "resume" ? resume(root, id, valueOf("--agent"), new Date(), { takeOver: args.includes("--take-over") }) : release(root, id);
        (result.ok ? print : printError)(result.message);
        return result.ok ? 0 : 1;
      }
      case "graph": {
        const file = path.join(root, "docs", "build", "graph.md");
        writeFileSync(file, renderGraph(board));
        print(`Wrote ${path.relative(root, file).split(path.sep).join("/")}.`);
        return 0;
      }
      case "next": {
        const max = Number(valueOf("--max")) || loadConfig(root).maxBuilders;
        const { picked, active, room } = nextBatch(board, max);
        if (!picked.length) {
          print(room ? "Nothing new can start without touching the same files as work in progress. Run the board with no command to see why." : `${active} builders are already working (the limit is ${max}). Merge something first.`);
          return 0;
        }
        print([`Start these ${picked.length} (their files don't overlap, ${active} already in progress, limit ${max}):`, ...picked.map((item) => `  node .agents/scripts/board.mjs start ${item.id} --agent <builder name>    # ${item.title}`)].join("\n"));
        return 0;
      }
      case "undo": {
        if (!id) {
          printError("Which item? undo <id>, then undo <id> --yes to go ahead.");
          return 1;
        }
        const result = undo(root, id, { yes: args.includes("--yes") });
        (result.ok ? print : printError)(result.message);
        return result.ok ? 0 : 1;
      }
      case "start":
      case "merge": {
        if (!id) {
          printError(`Which item? ${command} <id>${command === "start" ? " --agent <name>" : ""}`);
          return 1;
        }
        const result = command === "start" ? start(root, id, valueOf("--agent")) : merge(root, id);
        (result.ok ? print : printError)(result.message);
        return result.ok ? 0 : 1;
      }
      default:
        printError(`Unknown command "${command}". Use: status, ready, claim, resume, release, check, graph, next, start, merge or undo.`);
        return 1;
    }
  } catch (error) {
    printError(error.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
