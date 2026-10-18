import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkToolCall } from "../skills/agent-ready/guards/guard.mjs";

const BOARD = fileURLToPath(new URL("../skills/agent-ready/scripts/board.mjs", import.meta.url));

const PLAN = `# Phase 1: pages

## Iteration A: base

- [x] **ops-001** Skeleton \`task · S · Must\`
  - **Depends:** none
  - **Touches:** \`package.json\`

## Iteration B: pages

- [ ] **ui-001** Home page \`story · S · Must\`
  - **Depends:** ops-001
  - **Touches:** \`src/home.js\`
  - **Acceptance:**
    - Given a visitor, when they open the site, then they see a welcome line.
- [ ] **ui-002** About page \`story · S · Must\`
  - **Depends:** ops-001
  - **Touches:** \`src/about.js\`
- [ ] **ui-003** Shared header \`story · S · Should\`
  - **Depends:** ops-001
  - **Touches:** \`src/\`

## Iteration C: more

- [ ] **ui-010** Contact page \`story · S · Must\`
  - **Depends:** ui-001
  - **Touches:** \`src/contact.js\`
`;

function git(cwd, ...args) {
  const out = spawnSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=test", ...args], { cwd, encoding: "utf8" });
  assert.equal(out.status, 0, `git ${args.join(" ")}: ${out.stderr}`);
  return out.stdout.trim();
}

function board(cwd, ...args) {
  const out = spawnSync(process.execPath, [BOARD, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" },
  });
  return { code: out.status, stdout: out.stdout, stderr: out.stderr };
}

// A git project with one phase plan and board settings, committed on main.
function project(checks = ['node -e "process.exit(0)"']) {
  const base = mkdtempSync(path.join(os.tmpdir(), "agent-ready-par-"));
  const root = path.join(base, "app");
  mkdirSync(path.join(root, "docs", "build", "phases", "phase-1-pages"), { recursive: true });
  mkdirSync(path.join(root, ".agents"), { recursive: true });
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "docs", "build", "phases", "phase-1-pages", "plan.md"), PLAN);
  writeFileSync(path.join(root, ".agents", "board.json"), JSON.stringify({ mainBranch: "main", checks }));
  writeFileSync(path.join(root, "src", "shared.js"), "export const x = 1;\n");
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "plans");
  return { base, root, worktree: (id) => path.join(base, "app-worktrees", id) };
}

function commitIn(dir, file, text, message) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
  git(dir, "add", "--", file);
  git(dir, "commit", "-q", "-m", message);
}

const plan = (root) => readFileSync(path.join(root, "docs", "build", "phases", "phase-1-pages", "plan.md"), "utf8");

test("next picks ready items whose files don't overlap", () => {
  const p = project();
  try {
    const out = board(p.root, "next");
    assert.equal(out.code, 0, out.stderr);
    assert.match(out.stdout, /start ui-001/);
    assert.match(out.stdout, /start ui-002/);
    assert.doesNotMatch(out.stdout, /ui-003/, "ui-003 covers all of src/, so it waits");
    assert.doesNotMatch(out.stdout, /ui-010/, "ui-010 waits on ui-001");
    assert.match(board(p.root, "next", "--max", "1").stdout, /Start these 1/);
  } finally {
    rmSync(p.base, { recursive: true, force: true });
  }
});

test("start claims the item, makes its worktree and branch, and prints a brief", () => {
  const p = project();
  try {
    const out = board(p.root, "start", "ui-001", "--agent", "builder-1");
    assert.equal(out.code, 0, out.stderr);
    assert.match(out.stdout, /Brief for builder-1/);
    assert.match(out.stdout, /Given a visitor, when they open the site/);
    assert.ok(existsSync(path.join(p.worktree("ui-001"), "docs")), "the worktree exists");
    assert.equal(git(p.worktree("ui-001"), "rev-parse", "--abbrev-ref", "HEAD"), "agent/ui-001");
    assert.match(plan(p.root), /- \[~\] \*\*ui-001\*\*[\s\S]*?\*\*Claimed:\*\* builder-1, /);
    const again = board(p.root, "start", "ui-003", "--agent", "builder-2");
    assert.equal(again.code, 1, "ui-003 overlaps ui-001's files");
    assert.ok(!existsSync(p.worktree("ui-003")), "no worktree is made for a refused claim");
    assert.match(board(p.worktree("ui-001"), "start", "ui-002", "--agent", "x").stderr, /main checkout/);
  } finally {
    rmSync(p.base, { recursive: true, force: true });
  }
});

test("merge rebases, checks, merges, ticks the item and cleans up", () => {
  const p = project();
  try {
    board(p.root, "start", "ui-001", "--agent", "builder-1");
    assert.match(board(p.root, "merge", "ui-001").stderr, /no commits yet/);
    commitIn(p.worktree("ui-001"), "src/home.js", "export const home = 'hi';\n", "feat(ui-001): home page");
    commitIn(p.root, "src/shared.js", "export const x = 2;\n", "chore: unrelated change on main");

    const out = board(p.root, "merge", "ui-001");
    assert.equal(out.code, 0, out.stderr);
    assert.match(git(p.root, "log", "-1", "--format=%s"), /^merge\(ui-001\): Home page$/);
    assert.ok(existsSync(path.join(p.root, "src", "home.js")));
    assert.match(plan(p.root), /- \[x\] \*\*ui-001\*\*[\s\S]*?\*\*Done:\*\* \d{4}-\d{2}-\d{2}\. Merged from agent\/ui-001/);
    assert.doesNotMatch(plan(p.root), /Claimed:\*\* builder-1/);
    assert.ok(!existsSync(p.worktree("ui-001")), "the worktree is removed");
    assert.doesNotMatch(git(p.root, "branch"), /agent\/ui-001/, "the branch is deleted");
    assert.equal(git(p.root, "status", "--porcelain"), "", "the plan change went into the merge commit");
    assert.match(board(p.root, "ready").stdout, /ui-010/, "the item waiting on it is ready now");
  } finally {
    rmSync(p.base, { recursive: true, force: true });
  }
});

test("merge waits for dependencies and stops cleanly on a conflict", () => {
  const p = project();
  try {
    board(p.root, "start", "ui-001", "--agent", "builder-1");
    commitIn(p.worktree("ui-001"), "src/home.js", "a\n", "feat(ui-001): home");
    board(p.root, "merge", "ui-001");
    board(p.root, "start", "ui-010", "--agent", "builder-2");
    board(p.root, "start", "ui-002", "--agent", "builder-3");

    commitIn(p.worktree("ui-002"), "src/about.js", "from the builder\n", "feat(ui-002): about");
    commitIn(p.root, "src/about.js", "from main\n", "chore: someone changed about.js on main");
    const before = git(p.root, "rev-parse", "HEAD");
    const out = board(p.root, "merge", "ui-002");
    assert.equal(out.code, 1);
    assert.match(out.stderr, /conflicts with main in src\/about\.js/);
    assert.equal(git(p.root, "rev-parse", "HEAD"), before, "nothing was merged");
    assert.equal(git(p.worktree("ui-002"), "status", "--porcelain"), "", "the rebase was aborted");
  } finally {
    rmSync(p.base, { recursive: true, force: true });
  }
});

test("merge undoes itself when the checks fail on main afterwards", () => {
  // This check passes in a worktree (.git is a file there) and fails in the
  // main checkout (.git is a folder), so the branch is fine and main is not.
  const p = project(['node -e "process.exit(require(\'fs\').statSync(\'.git\').isDirectory() ? 1 : 0)"']);
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about");
    const out = board(p.root, "merge", "ui-002");
    assert.equal(out.code, 1);
    assert.match(out.stderr, /merge was undone with git revert/);
    assert.match(git(p.root, "log", "-1", "--format=%s"), /^Revert "merge\(ui-002\)/);
    assert.ok(!existsSync(path.join(p.root, "src", "about.js")), "the change is gone from main");
    assert.ok(existsSync(p.worktree("ui-002")), "the builder keeps its worktree");
    assert.match(board(p.root).stdout, /ui-002 {2}builder-1/, "and its claim");
  } finally {
    rmSync(p.base, { recursive: true, force: true });
  }
});

test("the guard keeps agents out of each other's claimed files", () => {
  const p = project();
  try {
    board(p.root, "start", "ui-001", "--agent", "builder-1");
    const wt = p.worktree("ui-001");
    const write = (cwd, file) => checkToolCall("Write", { file_path: file, content: "x" }, { cwd });

    assert.equal(write(wt, "src/home.js").blocked, false, "the builder writes its own file");
    assert.equal(write(wt, "docs/build/handoffs/ui-001.md").blocked, false, "and its report");
    const outside = write(wt, "src/about.js");
    assert.equal(outside.blocked, true, "but nothing outside its item");
    assert.match(outside.message, /outside the files your item covers \(ui-001: src\/home\.js\)/);

    const intrude = write(p.root, "src/home.js");
    assert.equal(intrude.blocked, true, "the main checkout can't write into a builder's files");
    assert.match(intrude.message, /builder-1 is working on ui-001, which covers src\/home\.js/);
    assert.equal(write(p.root, "src/about.js").blocked, false, "unclaimed files are free");
    assert.equal(write(p.root, path.join(p.root, "src", "home.js")).blocked, true, "absolute paths too");

    const patch = checkToolCall("apply_patch", { command: "*** Begin Patch\n*** Update File: src/home.js\n+x\n*** End Patch" }, { cwd: p.root });
    assert.equal(patch.blocked, true, "Codex patches are checked too");
    assert.equal(checkToolCall("Read", { file_path: "src/home.js" }, { cwd: p.root }).blocked, false, "reading is always fine");
    assert.equal(write(p.root, "src/home.js").blocked && !checkToolCall("Write", { file_path: "src/home.js" }, { cwd: p.root, claims: false }).blocked, true, "the check can be switched off for self-tests");
  } finally {
    rmSync(p.base, { recursive: true, force: true });
  }
});
