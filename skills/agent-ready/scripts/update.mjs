#!/usr/bin/env node
// agent-ready updater
//
// Moves this project to a newer agent-ready without touching your documents.
// agent-ready's own files (the guards, the scripts, the commands, and the copy
// of the skill in .agents/skills/agent-ready/) are replaced, unless you changed
// one: then yours is kept, and the update says so. Your documents (AGENTS.md,
// the rules, plans and to-dos) are never replaced. The update prints what is
// new for them, and an agent offers those edits one at a time, for your yes.
// No dependencies. Node 18 or newer.
//
//   node .agents/scripts/update.mjs               check for a newer version, and show what would change
//   node .agents/scripts/update.mjs --yes         update
//   node .agents/scripts/update.mjs --from <dir>  use a copy you downloaded: the repo folder, or its skills/agent-ready
//   node .agents/scripts/update.mjs --record      record what is installed now (the setup runs this)

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SOURCE = "https://github.com/Bbhuva/agent-ready";
export const RECORD = ".agents/agent-ready.json";
const SKILL_COPY = ".agents/skills/agent-ready";

const read = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};
// Line endings differ between checkouts on Windows and elsewhere; they don't count as a change.
const normalise = (text) => String(text).replace(/\r\n/g, "\n");
export const fingerprint = (text) => createHash("sha256").update(normalise(text)).digest("hex");

export function parseVersion(text) {
  const match = String(text ?? "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

// Negative when a is older than b. A missing or unknown version is older than any real one.
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// The entries of CHANGES.md newer than `from`, up to and including `to`, newest first.
export function changesBetween(changes, from, to) {
  return normalise(changes ?? "")
    .split(/^(?=## )/m)
    .filter((section) => section.startsWith("## "))
    .filter((section) => {
      const version = section.match(/^## v?(\d+\.\d+\.\d+)/)?.[1];
      return version && compareVersions(version, to) <= 0 && compareVersions(version, from) > 0;
    })
    .map((section) => section.trim());
}

// The files agent-ready owns in a project, and where each one comes from in the skill.
export function ownedFiles(skillDir) {
  const list = (dir, ext) => (existsSync(path.join(skillDir, dir)) ? readdirSync(path.join(skillDir, dir)).filter((name) => name.endsWith(ext)).sort() : []);
  return [
    ...["guard.mjs", "precommit-guard.mjs"].map((name) => ({ from: `guards/${name}`, to: `.agents/hooks/${name}` })),
    { from: "guards/git-pre-commit", to: ".githooks/pre-commit" },
    ...list("scripts", ".mjs").map((name) => ({ from: `scripts/${name}`, to: `.agents/scripts/${name}` })),
    ...list("commands", ".md").map((name) => ({ from: `commands/${name}`, to: `.agents/commands/${name}` })),
  ].filter((file) => existsSync(path.join(skillDir, file.from)));
}

export function readRecord(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, RECORD), "utf8"));
  } catch {
    return null;
  }
}

const versionOf = (skillDir) => read(path.join(skillDir, "VERSION"))?.trim() || null;

// Write the record: the version, and the fingerprint of each owned file as
// agent-ready shipped it. A file whose fingerprint later differs was changed here.
export function writeRecord(root, skillDir, { source } = {}) {
  const files = {};
  for (const file of ownedFiles(skillDir)) {
    if (existsSync(path.join(root, file.to))) files[file.to] = fingerprint(readFileSync(path.join(skillDir, file.from), "utf8"));
  }
  const data = { version: versionOf(skillDir) ?? "unknown", source: source ?? readRecord(root)?.source ?? SOURCE, updated: new Date().toISOString().slice(0, 10), files };
  writeFileSync(path.join(root, RECORD), `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

// What an update would do to each owned file: add, replace, keep (changed
// here), remove (no longer shipped, unchanged here) or same.
export function planUpdate(root, skillDir) {
  const record = readRecord(root);
  const steps = [];
  const owned = ownedFiles(skillDir);
  for (const file of owned) {
    const local = read(path.join(root, file.to));
    const shipped = readFileSync(path.join(skillDir, file.from), "utf8");
    if (local === null) {
      // New files go only where agent-ready already has a folder; the git hook only where the project uses it.
      if (!file.to.startsWith(".githooks/") && existsSync(path.dirname(path.join(root, file.to)))) steps.push({ action: "add", ...file });
    } else if (normalise(local) === normalise(shipped)) steps.push({ action: "same", ...file });
    else if (record?.files?.[file.to] && fingerprint(local) !== record.files[file.to]) steps.push({ action: "keep", ...file });
    else steps.push({ action: "replace", unrecorded: !record?.files?.[file.to], ...file });
  }
  const shippedNow = new Set(owned.map((file) => file.to));
  for (const [to, hash] of Object.entries(record?.files ?? {})) {
    const local = shippedNow.has(to) ? null : read(path.join(root, to));
    if (local !== null) steps.push({ action: fingerprint(local) === hash ? "remove" : "keep-retired", to });
  }
  return { record, steps };
}

function applyUpdate(root, skillDir, steps) {
  for (const step of steps) {
    const target = path.join(root, step.to);
    if (step.action === "add" || step.action === "replace") {
      mkdirSync(path.dirname(target), { recursive: true });
      const text = readFileSync(path.join(skillDir, step.from), "utf8");
      writeFileSync(target, step.to.startsWith(".githooks/") ? normalise(text) : text); // git hooks need Unix line endings
    } else if (step.action === "remove") unlinkSync(target);
  }
  const copy = path.join(root, SKILL_COPY);
  if (path.resolve(copy) !== path.resolve(skillDir)) {
    rmSync(copy, { recursive: true, force: true });
    cpSync(skillDir, copy, { recursive: true });
  }
}

function run(root, args) {
  const out = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  return { ok: out.status === 0, text: `${out.stdout ?? ""}${out.stderr ?? ""}`.trim() };
}

// After the files change: rewrite the /ar- commands for each tool, and run the self-tests.
function afterUpdate(root) {
  const lines = [];
  let ok = true;
  if (existsSync(path.join(root, ".agents", "scripts", "commands.mjs"))) {
    const codexPrompts = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "prompts", "ar-help.md");
    const codex = (read(codexPrompts) ?? "").includes("made by agent-ready");
    const installed = run(root, [".agents/scripts/commands.mjs", "install", ...(codex ? ["--codex"] : [])]);
    lines.push(installed.ok ? "Rewrote the /ar- commands for each tool." : `Could not rewrite the /ar- commands: ${installed.text}`);
    ok &&= installed.ok;
  }
  for (const [label, script] of [
    ["The guard", ".agents/hooks/guard.mjs"],
    ["The commit check", ".agents/hooks/precommit-guard.mjs"],
  ]) {
    if (!existsSync(path.join(root, script))) continue;
    const test = run(root, [script, "--self-test"]);
    lines.push(test.ok ? `${label} passes its self-test.` : `${label} FAILS its self-test. Run node ${script} --self-test to see which check.`);
    ok &&= test.ok;
  }
  return { ok, lines };
}

// Download the newest released version (or main, before the first release) to a temporary folder.
function download(source) {
  const tags = spawnSync("git", ["ls-remote", "--tags", "--refs", source], { encoding: "utf8" });
  if (tags.status !== 0) return { error: `could not reach ${source} (${(tags.stderr || tags.error?.message || "no answer").trim()})` };
  const versions = tags.stdout.split(/\r?\n/).map((line) => line.split("refs/tags/")[1]).filter((tag) => parseVersion(tag));
  const tag = versions.sort(compareVersions).pop();
  const dir = mkdtempSync(path.join(os.tmpdir(), "agent-ready-update-"));
  const clone = spawnSync("git", ["-c", "core.autocrlf=false", "clone", "-q", "--depth", "1", ...(tag ? ["--branch", tag] : []), source, path.join(dir, "repo")], { encoding: "utf8" });
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  if (clone.status !== 0) {
    cleanup();
    return { error: `could not download ${source} (${(clone.stderr || "").trim()})` };
  }
  return { skillDir: path.join(dir, "repo", "skills", "agent-ready"), ref: tag ?? "main", cleanup };
}

export function resolveSkill(dir) {
  if (existsSync(path.join(dir, "skills", "agent-ready", "SKILL.md"))) return path.join(dir, "skills", "agent-ready");
  if (existsSync(path.join(dir, "SKILL.md"))) return dir;
  return null;
}

// A project set up with agent-ready. A bare .agents/ folder is not enough:
// skill installers keep one in the home folder too.
const isProject = (dir) => [RECORD, ".agents/scripts/board.mjs", ".agents/hooks/guard.mjs"].some((sign) => existsSync(path.join(dir, sign)));

export function findRoot(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (isProject(dir)) return dir;
    if (path.dirname(dir) === dir) return path.resolve(start);
  }
}

const LABEL = { add: "add    ", replace: "replace", remove: "remove ", keep: "keep   ", "keep-retired": "keep   " };

function describe(step) {
  if (step.action === "keep") return `${step.to}: you changed it, so it stays as it is. The new version will be in ${SKILL_COPY}/${step.from}, to compare.`;
  if (step.action === "keep-retired") return `${step.to}: no longer part of agent-ready, but you changed it, so it stays.`;
  if (step.action === "remove") return `${step.to} (no longer part of agent-ready)`;
  return step.to;
}

export function main(argv, { print = console.log, cwd = process.cwd() } = {}) {
  const args = argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const root = valueOf("--root") ? path.resolve(cwd, valueOf("--root")) : findRoot(cwd);
  if (!isProject(root)) {
    print("This folder is not set up with agent-ready yet, so there is nothing to update. Set it up first with the paste-in prompt, or /ar-setup.");
    return 1;
  }
  const gitDir = spawnSync("git", ["rev-parse", "--git-dir", "--git-common-dir"], { cwd: root, encoding: "utf8" });
  const [own, common] = (gitDir.stdout ?? "").trim().split(/\r?\n/).map((p) => path.resolve(root, p));
  if (gitDir.status === 0 && own !== common) {
    print("This is a builder's worktree. Run the update from the main checkout, so every builder gets it when they next rebase.");
    return 1;
  }

  if (args.includes("--record")) {
    const copy = path.join(root, SKILL_COPY);
    if (!existsSync(path.join(copy, "SKILL.md"))) {
      print(`The copy of the skill in ${SKILL_COPY} is missing, so there is nothing to record. Type /ar-update to get the current version.`);
      return 1;
    }
    const data = writeRecord(root, copy);
    print(`Recorded agent-ready ${data.version} and ${Object.keys(data.files).length} of its files in ${RECORD}.`);
    return 0;
  }

  let skillDir;
  let where;
  let cleanup = () => {};
  if (valueOf("--from")) {
    skillDir = resolveSkill(path.resolve(cwd, valueOf("--from")));
    if (!skillDir) {
      print(`${valueOf("--from")} is not a copy of agent-ready: it needs skills/agent-ready/SKILL.md, or SKILL.md.`);
      return 1;
    }
    where = skillDir;
  } else {
    const source = readRecord(root)?.source ?? SOURCE;
    const got = download(source);
    if (got.error) {
      print(
        [
          `The update ${got.error}.`,
          `Download it yourself instead: ${source}/archive/refs/heads/main.zip. Unzip it, then run:`,
          "  node .agents/scripts/update.mjs --from <the unzipped folder>",
        ].join("\n"),
      );
      return 1;
    }
    ({ skillDir, cleanup } = got);
    where = `${source}, ${got.ref}`;
  }

  try {
    const next = versionOf(skillDir) ?? "unknown";
    const { record, steps } = planUpdate(root, skillDir);
    const current = record?.version ?? versionOf(path.join(root, SKILL_COPY));
    const changes = changesBetween(read(path.join(skillDir, "CHANGES.md")), current, next);
    const work = steps.filter((step) => ["add", "replace", "remove"].includes(step.action));

    if (current && parseVersion(current) && compareVersions(next, current) < 0) {
      const older = parseVersion(next) ? next : "a copy from before version numbers";
      print(`This project has agent-ready ${current}, which is newer than ${older} from ${where}. Nothing to do.`);
      return 0;
    }
    if (current && compareVersions(next, current) === 0 && !work.length) {
      print(`You're up to date: agent-ready ${current}.`);
      return 0;
    }

    const lines = [`You have agent-ready ${current ?? "from before version numbers (before 1.0.0)"}. The newest is ${next} (from ${where}).`];
    if (!record) lines.push("", "This project has no record of which version it has, so the update can't tell whether you changed any of its tool files. Every file marked replace gets the new version. If you changed one on purpose, say so before going ahead.");
    if (changes.length) lines.push("", "What's new:", "", changes.join("\n\n"));
    lines.push("", "agent-ready's own files:");
    for (const step of steps.filter((s) => s.action !== "same")) lines.push(`  ${LABEL[step.action]}  ${describe(step)}`);
    const same = steps.filter((s) => s.action === "same").length;
    if (same) lines.push(`  (${same} already up to date)`);
    lines.push(`  Also: the copy of the skill in ${SKILL_COPY} is replaced, and the /ar- commands are rewritten for each tool.`);
    lines.push("", 'Your documents are not touched. The "For your documents" lists above are what an agent offers to change, one edit at a time.');

    if (!args.includes("--yes")) {
      // Name the updater that is running: a project set up before 1.0.0 runs the downloaded one.
      const self = path.resolve(argv[1] ?? "");
      const shown = self === path.resolve(root, ".agents", "scripts", "update.mjs") ? ".agents/scripts/update.mjs" : `"${self}"`;
      lines.push("", `To go ahead: node ${shown} --yes${valueOf("--from") ? ` --from "${valueOf("--from")}"` : ""}`);
      print(lines.join("\n"));
      return 0;
    }

    applyUpdate(root, skillDir, steps);
    writeRecord(root, path.join(root, SKILL_COPY), { source: record?.source });
    const after = afterUpdate(root);
    print([...lines, "", `Updated to agent-ready ${next}: ${work.length} file${work.length === 1 ? "" : "s"} changed.`, ...after.lines, `Recorded the new version in ${RECORD}.`].join("\n"));
    return after.ok ? 0 : 1;
  } finally {
    cleanup();
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) process.exitCode = main(process.argv);
