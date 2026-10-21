#!/usr/bin/env node
// agent-ready health check
//
// Looks over the whole setup and says, in plain words, what is fine and what
// needs a look: the map, the docs, the guards and whether each tool runs them,
// the git check, the plans, the keys, leftover worktrees. Run it at the end of
// setup, at the end of every phase, and whenever something feels off.
// No dependencies. Node 18 or newer.
//
//   node .agents/scripts/health.mjs            the report; exit code 1 if anything failed
//   node .agents/scripts/health.mjs --json     the same, for a script

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { loadBoard, review } from "./board.mjs";
import { keyStatus } from "./keys.mjs";
import { detectTools, loadCommands, TOOLS } from "./commands.mjs";

const MAP_LIMIT = 100;
const RULES = ["workflow", "parallel", "testing", "docs", "git", "review", "bugs"].map((name) => `docs/rules/${name}.md`);
const DOCS = ["docs/build/README.md", "docs/build/backlog.md", "docs/build/decisions.md", "docs/operator/todo.md", "docs/operator/mtest.md", "docs/operator/guide.md", "docs/operator/run.md", "docs/operator/launch.md", "docs/words.md", "docs/stack.md", "docs/security.md"];
// Package manager words that are not the project's own scripts.
const PACKAGE_BUILTINS = new Set(["install", "i", "ci", "add", "remove", "rm", "uninstall", "update", "up", "upgrade", "exec", "dlx", "x", "create", "init", "link", "outdated", "audit", "why"]);
const CODE_FILES = /\.(m?[jt]sx?|cjs|py|rb|go|rs|java|kt|swift|php|cs|sh|ps1|bat|sql|css|scss|vue|svelte|astro)$/i;

const read = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

function git(root, ...args) {
  const out = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { ok: out.status === 0, status: out.status, out: (out.stdout ?? "").trim() };
}

function walk(dir, skip = () => false) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (skip(full)) return [];
    return entry.isDirectory() ? walk(full, skip) : [full];
  });
}

// The run card is what the operator types themselves, so it must be true:
// rows waiting on an item that is done, and npm, pnpm, yarn or bun commands
// whose script package.json doesn't have, are problems.
export function runCardProblems(root, board) {
  const text = read(path.join(root, "docs", "operator", "run.md"));
  if (text === null) return [];
  const problems = [];
  const done = new Set((board?.items ?? []).filter((item) => item.status === "done").map((item) => item.id));
  const stale = [...new Set([...text.matchAll(/Not ready yet \(([\w.-]+) sets it up\)/gi)].map((m) => m[1]))].filter((id) => done.has(id));
  if (stale.length) problems.push(`It still says "Not ready yet" for ${stale.join(", ")}, which ${stale.length > 1 ? "are" : "is"} done. Fill in the real commands.`);
  let scripts = null;
  try {
    scripts = JSON.parse(read(path.join(root, "package.json")) ?? "null")?.scripts ?? null;
  } catch {
    scripts = null;
  }
  if (scripts) {
    for (const [, command] of text.matchAll(/`([^`\n]+)`/g)) {
      const words = command.trim().match(/^(npm|pnpm|yarn|bun)\s+(run\s+|run-script\s+)?([\w:.-]+)/);
      if (!words || words[3].startsWith("-")) continue;
      const [, tool, run, name] = words;
      if (!run && (tool === "npm" ? !["test", "t", "start"].includes(name) : PACKAGE_BUILTINS.has(name))) continue;
      const script = name === "t" ? "test" : name;
      if (!(script in scripts)) problems.push(`\`${command.trim()}\` needs a "${script}" script in package.json, and there is none.`);
    }
  }
  return problems;
}

export function runHealth(root) {
  const results = [];
  const add = (status, title, detail = "") => results.push({ status, title, detail });
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");
  const isGit = git(root, "rev-parse", "--show-toplevel").ok;

  // The map every agent reads first.
  const agents = read(path.join(root, "AGENTS.md"));
  if (agents === null) add("fail", "AGENTS.md is missing", "Every agent reads it first. Run the agent-ready setup again.");
  else {
    const lines = agents.trimEnd().split(/\r?\n/).length;
    if (agents.includes("{{")) add("fail", "AGENTS.md still has blanks to fill in", "Look for {{ ... }} and replace it with this project's details.");
    else if (lines > MAP_LIMIT) add("warn", `AGENTS.md is ${lines} lines`, `Keep it under ${MAP_LIMIT}. Move detail into docs/rules/ and point to it.`);
    else add("ok", `AGENTS.md is a short map (${lines} lines)`);
  }
  for (const name of ["CLAUDE.md", "GEMINI.md"]) {
    const text = read(path.join(root, name));
    if (text !== null && !/^@AGENTS\.md\s*$/m.test(text)) add("warn", `${name} does not point at AGENTS.md`, "Add the line @AGENTS.md at the top, so this tool follows the same rules.");
  }

  // The documents.
  const missing = [...RULES, ...DOCS].filter((doc) => !existsSync(path.join(root, doc)));
  if (missing.length) add("warn", `${missing.length} expected docs are missing`, missing.join(", "));
  else add("ok", "All the rules and working docs are there");
  const docFiles = walk(path.join(root, "docs"), (full) => rel(full).startsWith("docs/build/templates") || rel(full).startsWith("docs/archive"));
  const outsideExamples = (text) => text.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1/gm, ""); // blanks inside code examples are meant to stay
  const blanks = docFiles.filter((file) => file.endsWith(".md") && outsideExamples(read(file) ?? "").includes("{{")).map(rel);
  if (blanks.length) add("warn", "Some docs still have blanks to fill in", blanks.join(", "));
  const code = docFiles.filter((file) => CODE_FILES.test(file) && !rel(file).startsWith("docs/reference/")).map(rel);
  if (code.length) add("fail", "Code is sitting in docs/", `${code.join(", ")}. docs/ holds documents only; move these to the folders in docs/stack.md.`);
  else add("ok", "docs/ holds documents only");

  // Which agent-ready this is, so /ar-update can move it on.
  const installed = read(path.join(root, ".agents", "agent-ready.json"));
  let version = null;
  try {
    version = installed && JSON.parse(installed).version;
  } catch {
    version = null;
  }
  if (version) add("ok", `agent-ready ${version} (type /ar-update for a newer one)`);
  else if (existsSync(path.join(root, ".agents"))) add("warn", "There is no record of which agent-ready version this is", "Run node .agents/scripts/update.mjs --record, so /ar-update can tell agent-ready's files from changes made here.");

  // The guards.
  const guard = path.join(root, ".agents", "hooks", "guard.mjs");
  if (!existsSync(guard)) add("fail", "The guard is not installed", "Copy guard.mjs to .agents/hooks/ (the agent-ready setup does this).");
  else {
    const selfTest = spawnSync(process.execPath, [guard, "--self-test"], { cwd: root, encoding: "utf8" });
    add(selfTest.status === 0 ? "ok" : "fail", selfTest.status === 0 ? "The guard passes its self-test" : "The guard fails its self-test", selfTest.status === 0 ? "" : "Run node .agents/hooks/guard.mjs --self-test to see which check fails.");
  }
  const tools = [
    ["Claude Code", ".claude", ".claude/settings.json"],
    ["Codex", ".codex", ".codex/config.toml"],
    ["Cursor", ".cursor", ".cursor/hooks.json"],
    ["Gemini CLI or Antigravity", ".gemini", ".gemini/settings.json"],
  ];
  const wired = [];
  for (const [tool, folder, config] of tools) {
    const text = read(path.join(root, config));
    if (text?.includes("guard.mjs")) wired.push(tool);
    else if (existsSync(path.join(root, folder))) add("fail", `${tool} is set up here but does not run the guard`, `Add the guard hook to ${config}.`);
  }
  const opencode = path.join(root, ".opencode", "plugins");
  if (existsSync(opencode) && readdirSync(opencode).some((name) => (read(path.join(opencode, name)) ?? "").includes("guard.mjs"))) wired.push("OpenCode");
  if (wired.length) add("ok", `The guard runs in: ${wired.join(", ")}`);
  else add("warn", "No agent tool is set up to run the guard", "Add the hook for the tool you use (see the agent-ready setup, step 5).");

  // The operator's commands.
  const commands = loadCommands(root);
  if (!commands.length) add("warn", "The /ar- commands are not set up", "Copy the skill's commands/ folder to .agents/commands/, then run node .agents/scripts/commands.mjs install.");
  else {
    const tools = detectTools(root);
    const missingFor = tools.filter((key) => !existsSync(path.join(root, TOOLS[key].dir, TOOLS[key].file("ar-help"))));
    if (missingFor.length) add("warn", `The /ar- commands are missing in ${missingFor.map((key) => TOOLS[key].label).join(", ")}`, "Run node .agents/scripts/commands.mjs install.");
    else add("ok", `${commands.length} /ar- commands${tools.length ? ` in ${tools.map((key) => TOOLS[key].label).join(", ")}` : ""}`);
    if (!existsSync(path.join(root, "docs", "operator", "commands.md"))) add("warn", "The operator's command list is missing", "Run node .agents/scripts/commands.mjs install to write docs/operator/commands.md.");
  }

  // Git: the secret check on every commit, and .env kept out.
  if (isGit) {
    const hooksPath = git(root, "config", "core.hooksPath").out;
    const candidates = [hooksPath && path.join(root, hooksPath, "pre-commit"), path.join(root, ".husky", "pre-commit"), path.join(root, ".git", "hooks", "pre-commit"), path.join(root, "lefthook.yml"), path.join(root, ".pre-commit-config.yaml")].filter(Boolean);
    if (candidates.some((file) => (read(file) ?? "").includes("precommit-guard"))) add("ok", "Every commit is checked for secrets");
    else add("warn", "Commits are not checked for secrets", "Wire .agents/hooks/precommit-guard.mjs into git (the agent-ready setup, step 5).");
    const ignored = git(root, "check-ignore", "-q", ".env");
    add(ignored.status === 0 ? "ok" : "fail", ignored.status === 0 ? ".env is kept out of git" : ".env is not in .gitignore", ignored.status === 0 ? "" : "Add .env and .env.* (but not .env.example) to .gitignore now.");
  } else {
    add("warn", "This folder is not a git repo", "Without git there are no save points to go back to. Ask an agent to add 'set up git' to your to-do list.");
  }

  // The plans.
  if (existsSync(path.join(root, "docs", "build"))) {
    const board = loadBoard(root);
    const { problems, warnings } = review(board);
    if (problems.length) add("fail", `The plans have ${problems.length} problem${problems.length > 1 ? "s" : ""}`, problems.join(" "));
    else add("ok", `The plans check out (${board.items.length} items)`);
    for (const warning of warnings) add("warn", "A claim needs a look", warning);
    const open = board.items.filter((item) => item.phase === "operator" && item.status === "todo");
    if (open.length) add("warn", `${open.length} thing${open.length > 1 ? "s" : ""} on your to-do list`, open.map((item) => `${item.id} ${item.title}`).join("; "));
  }

  // The run card the operator types from.
  const card = read(path.join(root, "docs", "operator", "run.md"));
  if (card !== null) {
    const problems = runCardProblems(root, existsSync(path.join(root, "docs", "build")) ? loadBoard(root) : null);
    if (problems.length) add("warn", "The run card in docs/operator/run.md needs a look", problems.join(" "));
    else if (!card.includes("{{") && !/Not ready yet/i.test(card)) add("ok", "The run card is ready (docs/operator/run.md)");
  }

  // Keys: names only, never values.
  if (existsSync(path.join(root, ".env.example"))) {
    const keys = keyStatus(root);
    if (keys.missing.length) add("warn", `${keys.missing.length} key${keys.missing.length > 1 ? "s are" : " is"} not set yet`, `${keys.missing.join(", ")}. Add each with: node .agents/scripts/keys.mjs add <NAME>`);
    else add("ok", "Every required key is set");
  }

  // Worktrees left behind after their branch was merged.
  if (isGit) {
    const merged = new Set(git(root, "branch", "--merged").out.split(/\r?\n/).map((line) => line.replace(/^[*+]?\s*/, "").trim()));
    const leftovers = [];
    let current = null;
    for (const line of git(root, "worktree", "list", "--porcelain").out.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) current = line.slice(9);
      const branch = line.match(/^branch refs\/heads\/(agent\/.+)$/)?.[1];
      if (branch && merged.has(branch)) leftovers.push(`${current} (${branch})`);
    }
    if (leftovers.length) add("warn", "Finished worktrees are still lying around", `${leftovers.join(", ")}. Remove each with git worktree remove, then git branch -d.`);
  }

  // Handoff notes for work that is long finished.
  const handoffs = path.join(root, "docs", "build", "handoffs");
  if (existsSync(handoffs)) {
    const old = readdirSync(handoffs).filter((name) => Date.now() - statSync(path.join(handoffs, name)).mtimeMs > 30 * 24 * 60 * 60 * 1000);
    if (old.length) add("warn", `${old.length} handoff note${old.length > 1 ? "s are" : " is"} over a month old`, "If the work is done, move them to docs/archive/.");
  }

  return results;
}

function print(results) {
  const label = { ok: "OK  ", warn: "LOOK", fail: "FIX " };
  const lines = results.map((r) => `${label[r.status]}  ${r.title}${r.detail ? `\n      ${r.detail}` : ""}`);
  const ok = results.filter((r) => r.status === "ok").length;
  const fails = results.filter((r) => r.status === "fail").length;
  const looks = results.filter((r) => r.status === "warn").length;
  lines.push("", `Health: ${ok} of ${results.length} OK${fails ? `, ${fails} to fix` : ""}${looks ? `, ${looks} to look at` : ""}.`);
  return lines.join("\n");
}

export function main(argv = process.argv) {
  const args = argv.slice(2);
  const root = args.includes("--root") ? path.resolve(args[args.indexOf("--root") + 1]) : process.cwd();
  const results = runHealth(root);
  console.log(args.includes("--json") ? JSON.stringify(results, null, 2) : print(results));
  return results.some((r) => r.status === "fail") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
