// Regression tests for recovering from things going wrong: a merge whose undo
// works or fails (AR-FIX-001), picking up paused work (AR-FIX-002), undoing an
// item's save points (AR-FIX-003), the guard reading shell writes (AR-FIX-004),
// bringing back only the recovered item's work (AR-FIX-005), and undos that
// were themselves reversed (AR-FIX-006). Every git test runs in a throwaway
// repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkToolCall, shellWriteTargets } from "../skills/agent-ready/guards/guard.mjs";

const BOARD = fileURLToPath(new URL("../skills/agent-ready/scripts/board.mjs", import.meta.url));
const ENV = { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };

const PLAN = `# Phase 1: pages

## Iteration A: base

- [x] **ops-001** Skeleton \`task · S · Must\`
  - **Depends:** none
  - **Touches:** \`package.json\`

## Iteration B: pages

- [ ] **ui-001** Home page \`story · S · Must\`
  - **Depends:** ops-001
  - **Touches:** \`src/home.js\`
- [ ] **ui-002** About page \`story · S · Must\`
  - **Depends:** ops-001
  - **Touches:** \`src/about.js\`
- [ ] **ui-003** Shared header \`story · S · Should\`
  - **Depends:** ops-001
  - **Touches:** \`src/\`

## Iteration C: more

- [ ] **ui-010** Team page \`story · S · Must\`
  - **Depends:** ui-002
  - **Touches:** \`src/team.js\`
`;

function git(cwd, ...args) {
  const out = spawnSync("git", args, { cwd, encoding: "utf8", env: ENV });
  assert.equal(out.status, 0, `git ${args.join(" ")}: ${out.stderr}`);
  return out.stdout.trim();
}

function board(cwd, ...args) {
  const out = spawnSync(process.execPath, [BOARD, ...args], { cwd, encoding: "utf8", env: ENV });
  return { code: out.status, stdout: out.stdout, stderr: out.stderr, all: `${out.stdout}${out.stderr}` };
}

function project(checks = []) {
  const base = mkdtempSync(path.join(os.tmpdir(), "agent-ready-rec-"));
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
  return { base, root, worktree: (id) => path.join(base, "app-worktrees", id), done: () => rmSync(base, { recursive: true, force: true }) };
}

function commitIn(dir, file, text, message) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
  git(dir, "add", "--", file);
  git(dir, "commit", "-q", "-m", message);
}

const planOf = (root) => readFileSync(path.join(root, "docs", "build", "phases", "phase-1-pages", "plan.md"), "utf8");
const markOf = (root, id) => planOf(root).match(new RegExp(`- \\[(.)\\] \\*\\*${id}\\*\\*`))?.[1];
const entryOf = (root, id) => planOf(root).split(new RegExp(`(?=- \\[.\\] \\*\\*)`)).find((part) => part.includes(`**${id}**`)) ?? "";
const setPlan = (root, text) => writeFileSync(path.join(root, "docs", "build", "phases", "phase-1-pages", "plan.md"), text);
const claims = (root) => JSON.parse(readFileSync(path.join(root, ".git", "agent-ready", "claims.json"), "utf8"));

// Passes in a builder's worktree (.git is a file there). In the main checkout
// (.git is a folder) it fails until a file named FIXED exists.
const FAILS_ON_MAIN_UNTIL_FIXED = `node -e "const fs=require('fs');process.exit(fs.statSync('.git').isDirectory()&&!fs.existsSync('FIXED')?1:0)"`;
// Passes in a worktree. In the main checkout it edits a tracked feature file, then fails.
const DIRTIES_MAIN_THEN_FAILS = `node -e "const fs=require('fs');if(fs.statSync('.git').isDirectory()){fs.appendFileSync('src/about.js','// changed by the check');process.exit(1)}"`;
// Like FAILS_ON_MAIN_UNTIL_FIXED, but only while the home page is on main, so
// other items merge normally.
const HOME_FAILS_ON_MAIN_UNTIL_FIXED = `node -e "const fs=require('fs');process.exit(fs.statSync('.git').isDirectory()&&fs.existsSync('src/home.js')&&!fs.existsSync('FIXED')?1:0)"`;

// ---------------------------------------------------------------------------
// AR-FIX-001: a merge that breaks main
// ---------------------------------------------------------------------------

test("AR-FIX-001: a successful undo is verified, and the fixed branch merges back in full", () => {
  const p = project([FAILS_ON_MAIN_UNTIL_FIXED]);
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");
    const before = git(p.root, "rev-parse", "HEAD");

    const first = board(p.root, "merge", "ui-002");
    assert.equal(first.code, 1);
    assert.match(first.stderr, /so the merge was undone/);
    assert.match(first.stderr, /back exactly as it was before the merge \(checked\)/);
    assert.match(first.stderr, /ui-002 is back in progress for builder-1/);
    assert.equal(git(p.root, "diff", before, "HEAD", "--stat"), "", "main's files match the state before the merge");
    assert.equal(markOf(p.root, "ui-002"), "~", "in progress again, not done");
    assert.match(entryOf(p.root, "ui-002"), /\*\*Claimed:\*\* builder-1, .*app-worktrees/);
    assert.match(entryOf(p.root, "ui-002"), /\*\*Merge undone:\*\*/);
    assert.equal(claims(p.root)["ui-002"]?.agent, "builder-1", "the claim is kept");
    assert.ok(existsSync(p.worktree("ui-002")), "the worktree is kept");
    assert.doesNotMatch(board(p.root, "ready").stdout, /ui-010/, "work waiting on it does not start");

    commitIn(p.worktree("ui-002"), "FIXED", "\n", "fix(ui-002): make the checks pass");
    const second = board(p.root, "merge", "ui-002");
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /Brought back the work from the undone merge/);
    assert.ok(existsSync(path.join(p.root, "FIXED")), "the fix is on main");
    assert.ok(existsSync(path.join(p.root, "src", "about.js")), "and so is the original feature, not silently left out");
    assert.equal(markOf(p.root, "ui-002"), "x");
    assert.equal(claims(p.root)["ui-002"], undefined);
  } finally {
    p.done();
  }
});

test("AR-FIX-001: when the undo fails, it says so and leaves a recoverable state", () => {
  const p = project([DIRTIES_MAIN_THEN_FAILS]);
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");

    const out = board(p.root, "merge", "ui-002");
    assert.equal(out.code, 1);
    assert.match(out.stderr, /Undoing the merge failed too, so the merge is still in place/);
    assert.match(out.stderr, /Why the undo failed: .+/);
    assert.match(out.stderr, /Files changed since the merge, kept exactly as they are: src\/about\.js/);
    assert.doesNotMatch(out.stderr, /merge was undone/, "never claims an undo that didn't happen");
    assert.match(git(p.root, "log", "-1", "--format=%s"), /^merge\(ui-002\)/, "the merge is still HEAD");
    assert.match(readFileSync(path.join(p.root, "src", "about.js"), "utf8"), /changed by the check/, "the changes are not thrown away");
    assert.equal(markOf(p.root, "ui-002"), "!", "blocked, not done");
    assert.match(entryOf(p.root, "ui-002"), /\*\*Blocked:\*\* merged as [0-9a-f]{7} .* could not be undone automatically\. It is not done\./);
    assert.equal(claims(p.root)["ui-002"]?.agent, "builder-1", "the claim is kept");
    assert.ok(existsSync(p.worktree("ui-002")), "the worktree is kept");
    assert.doesNotMatch(board(p.root, "ready").stdout, /ui-010/, "work waiting on it does not start");
  } finally {
    p.done();
  }
});

// ---------------------------------------------------------------------------
// AR-FIX-002: paused work can be picked up, active work can't be taken
// ---------------------------------------------------------------------------

function pauseUi001(p, agent = "agent-a") {
  board(p.root, "claim", "ui-001", "--agent", agent);
  setPlan(p.root, planOf(p.root).replace("- [ ] **ui-001**", "- [~] **ui-001**").replace("  - **Touches:** `src/home.js`", `  - **Touches:** \`src/home.js\`\n  - **Claimed:** ${agent}, 2026-10-19 09:00`));
}

test("AR-FIX-002: a handed-off item shows as paused and another agent resumes it", () => {
  const p = project();
  try {
    pauseUi001(p);
    writeFileSync(path.join(p.root, "src", "home.js"), "half done\n"); // partial, uncommitted work
    mkdirSync(path.join(p.root, "docs", "build", "handoffs"), { recursive: true });
    writeFileSync(path.join(p.root, "docs", "build", "handoffs", "2026-10-19-home.md"), "# Handoff\n\nui-001 is half built.\n");
    assert.match(board(p.root, "release", "ui-001").stdout, /shows as paused work/);

    const status = board(p.root).stdout;
    assert.match(status, /Paused .*:\n {2}ui-001 {2}Home page, last worked on by agent-a; read first: docs\/build\/handoffs\/2026-10-19-home\.md/);
    assert.match(board(p.root, "ready").stdout, /ui-001 .*paused: pick it up first with resume ui-001/);
    assert.match(board(p.root, "claim", "ui-001", "--agent", "agent-b").stderr, /paused work .*resume ui-001/, "claim points to resume");

    const out = board(p.root, "resume", "ui-001", "--agent", "agent-b");
    assert.equal(out.code, 0, out.stderr);
    assert.match(out.stdout, /agent-b has picked up ui-001: Home page, picked up from agent-a/);
    assert.match(out.stdout, /Read first: docs\/build\/handoffs\/2026-10-19-home\.md/);
    assert.equal(readFileSync(path.join(p.root, "src", "home.js"), "utf8"), "half done\n", "partial work is kept");
    assert.match(entryOf(p.root, "ui-001"), /\*\*Claimed:\*\* agent-b, .*picked up from agent-a/);
    assert.equal(markOf(p.root, "ui-001"), "~", "same item, same ID, still in progress");
    assert.equal(claims(p.root)["ui-001"].agent, "agent-b");
  } finally {
    p.done();
  }
});

test("AR-FIX-002: another agent's fresh claim can't be taken, by claim or resume", () => {
  const p = project();
  try {
    pauseUi001(p, "agent-a"); // claimed now, still held
    const resume = board(p.root, "resume", "ui-001", "--agent", "agent-b");
    assert.equal(resume.code, 1);
    assert.match(resume.stderr, /agent-a is working on ui-001 .*can't be taken over/);
    assert.equal(board(p.root, "resume", "ui-001", "--agent", "agent-b", "--take-over").code, 1, "not even with --take-over");
    assert.equal(board(p.root, "claim", "ui-001", "--agent", "agent-b").code, 1);
    assert.equal(claims(p.root)["ui-001"].agent, "agent-a");
    assert.equal(board(p.root, "claim", "ui-003", "--agent", "agent-b").code, 1, "and its files stay protected");
    assert.equal(board(p.root, "resume", "ui-001", "--agent", "agent-a").code, 0, "the holder can resume it in a new session");
  } finally {
    p.done();
  }
});

test("AR-FIX-002: a stale claim is taken over only on purpose", () => {
  const p = project();
  try {
    pauseUi001(p, "agent-a");
    const file = path.join(p.root, ".git", "agent-ready", "claims.json");
    const record = claims(p.root);
    record["ui-001"].at = "2026-01-01T00:00:00.000Z";
    writeFileSync(file, JSON.stringify(record));

    const without = board(p.root, "resume", "ui-001", "--agent", "agent-b");
    assert.equal(without.code, 1);
    assert.match(without.stderr, /the claim is stale.*--take-over/s);
    const taken = board(p.root, "resume", "ui-001", "--agent", "agent-b", "--take-over");
    assert.equal(taken.code, 0, taken.stderr);
    assert.match(taken.stdout, /picked up from agent-a/);
    assert.equal(claims(p.root)["ui-001"].agent, "agent-b");
  } finally {
    p.done();
  }
});

test("AR-FIX-002: paused parallel work resumes in its own worktree, and keeps its files covered", () => {
  const p = project();
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "half\n", "feat(ui-002): start the about page");
    board(p.root, "release", "ui-002");
    assert.equal(board(p.root, "claim", "ui-003", "--agent", "x").code, 1, "paused work still holds its files");

    const out = board(p.root, "resume", "ui-002", "--agent", "builder-2");
    assert.equal(out.code, 0, out.stderr);
    assert.match(out.stdout, /app-worktrees[\\/]ui-002\. Its branch agent\/ui-002 has 1 commit so far/);
    assert.equal(path.resolve(claims(p.root)["ui-002"].root), path.resolve(p.worktree("ui-002")), "the claim points at the same worktree");
    const write = (cwd, file) => checkToolCall("Write", { file_path: file, content: "x" }, { cwd }).blocked;
    assert.equal(write(p.worktree("ui-002"), "src/about.js"), false, "so the new builder can work there");
    assert.equal(write(p.root, "src/about.js"), true, "and nobody else can write its files");
  } finally {
    p.done();
  }
});

test("AR-FIX-002: resume refuses items that were never started", () => {
  const p = project();
  try {
    const out = board(p.root, "resume", "ui-001", "--agent", "agent-b");
    assert.equal(out.code, 1);
    assert.match(out.stderr, /nothing to resume\. To start it, use: claim ui-001/);
  } finally {
    p.done();
  }
});

// ---------------------------------------------------------------------------
// AR-FIX-003: undo an item's save points, ordinary or merged, once each
// ---------------------------------------------------------------------------

test("AR-FIX-003: undoing an ordinary save point reverts it once and reopens the item", () => {
  const p = project(['node -e "process.exit(0)"']);
  try {
    setPlan(p.root, planOf(p.root).replace("- [ ] **ui-001**", "- [x] **ui-001**"));
    writeFileSync(path.join(p.root, "src", "home.js"), "home\n");
    git(p.root, "add", "-A");
    git(p.root, "commit", "-q", "-m", "feat(ui-001): home page");

    const dry = board(p.root, "undo", "ui-001");
    assert.equal(dry.code, 0);
    assert.match(dry.stdout, /would add 1 new commit that reverses this save point:\n {2}[0-9a-f]{7} {2}feat\(ui-001\): home page/);
    assert.ok(existsSync(path.join(p.root, "src", "home.js")), "a dry run changes nothing");

    const out = board(p.root, "undo", "ui-001", "--yes");
    assert.equal(out.code, 0, out.stderr);
    assert.match(out.stdout, /ui-001 is open again/);
    assert.match(out.stdout, /The checks pass/);
    assert.ok(!existsSync(path.join(p.root, "src", "home.js")));
    assert.equal(markOf(p.root, "ui-001"), " ");
    assert.match(entryOf(p.root, "ui-001"), /\*\*Undone:\*\*/);
    assert.equal(git(p.root, "status", "--porcelain"), "", "everything is saved");
    assert.match(board(p.root, "undo", "ui-001", "--yes").stdout, /Nothing to undo for ui-001/, "never undone twice");
  } finally {
    p.done();
  }
});

test("AR-FIX-003: undoing a merged item reverts the merge once, not its builder's commits again", () => {
  const p = project(['node -e "process.exit(0)"']);
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");
    commitIn(p.worktree("ui-002"), "src/about.css", "a {}\n", "feat(ui-002): style it");
    assert.equal(board(p.root, "merge", "ui-002").code, 0);
    commitIn(p.root, "src/home.js", "home\n", "feat(ui-001): home page");

    const dry = board(p.root, "undo", "ui-002");
    assert.match(dry.stdout, /merge\(ui-002\): About page {2}\(a merge: undone in one step/);
    assert.doesNotMatch(dry.stdout, /feat\(ui-002\)/, "the builder's commits are not listed separately");

    const out = board(p.root, "undo", "ui-002", "--yes");
    assert.equal(out.code, 0, out.stderr);
    const reverts = git(p.root, "log", "--format=%s").split("\n").filter((s) => s.startsWith("Revert"));
    assert.deepEqual(reverts, ['Revert "merge(ui-002): About page"'], "exactly one revert, of the merge");
    assert.ok(!existsSync(path.join(p.root, "src", "about.js")) && !existsSync(path.join(p.root, "src", "about.css")), "all of the item's work is gone");
    assert.ok(existsSync(path.join(p.root, "src", "home.js")), "later, unrelated work is kept");
    assert.equal(markOf(p.root, "ui-002"), " ");
    assert.match(board(p.root, "undo", "ui-002").stdout, /Nothing to undo/);
  } finally {
    p.done();
  }
});

test("AR-FIX-003: undo refuses while there are unsaved changes", () => {
  const p = project();
  try {
    commitIn(p.root, "src/home.js", "home\n", "feat(ui-001): home page");
    writeFileSync(path.join(p.root, "src", "shared.js"), "edited, not saved\n");
    const out = board(p.root, "undo", "ui-001", "--yes");
    assert.equal(out.code, 1);
    assert.match(out.stderr, /unsaved changes \(src\/shared\.js\)/);
    assert.ok(existsSync(path.join(p.root, "src", "home.js")), "nothing was undone");
    assert.equal(readFileSync(path.join(p.root, "src", "shared.js"), "utf8"), "edited, not saved\n");
  } finally {
    p.done();
  }
});

// ---------------------------------------------------------------------------
// AR-FIX-004: shell commands that name the file they write
// ---------------------------------------------------------------------------

test("AR-FIX-004: the guard reads the files plain shell commands write", () => {
  const cases = [
    ["Set-Content src/home.js 'synthetic'", ["src/home.js"]],
    ["echo hi > src/home.js", ["src/home.js"]],
    ["echo hi >> src/home.js 2>&1", ["src/home.js"]],
    ["cp notes.txt src/home.js", ["src/home.js"]],
    ["cp src/home.js backup.js", ["backup.js"]],
    ["mv src/home.js src/old.js", ["src/home.js", "src/old.js"]],
    ["rm -f src/home.js", ["src/home.js"]],
    ["tee -a src/home.js", ["src/home.js"]],
    ["sed -i s/a/b/ src/home.js", ["src/home.js"]],
    ["perl -pi -e s/a/b/ src/home.js", ["src/home.js"]],
    ['bash -lc "echo x > src/home.js"', ["src/home.js"]],
    ['pwsh -Command "Set-Content -Path src/home.js -Value x"', ["src/home.js"]],
    ['"x" | Out-File src/home.js', ["src/home.js"]],
    ["git restore src/home.js", ["src/home.js"]],
    ["git checkout -- src/home.js", ["src/home.js"]],
    ["npm test", []],
    ["npm run build > build.log 2>&1", ["build.log"]],
    ["echo x > /dev/null", []],
    ["node -e \"require('fs').writeFileSync('src/home.js','x')\"", []], // not covered by design: interpreters
  ];
  for (const [command, expected] of cases) assert.deepEqual(shellWriteTargets(command), expected, command);
});

test("AR-FIX-004: shell writes into a claimed file are refused; normal commands still run", () => {
  const p = project();
  try {
    board(p.root, "start", "ui-001", "--agent", "builder-1");
    const wt = p.worktree("ui-001");
    const shell = (cwd, tool, input) => checkToolCall(tool, input, { cwd }).blocked;

    assert.equal(shell(p.root, "exec_command", { cmd: "Set-Content src/home.js 'synthetic'" }), true, "the reported case");
    assert.equal(shell(p.root, "Bash", { command: "echo hi > src/home.js" }), true);
    assert.equal(shell(p.root, "PowerShell", { command: '"x" | Out-File -FilePath src/home.js' }), true);
    assert.equal(shell(p.root, "Bash", { command: ["bash", "-lc", "sed -i s/a/b/ src/home.js"] }), true, "Codex's array form");
    assert.equal(shell(p.root, "Bash", { command: "cp src/home.js /tmp/copy.js" }), false, "reading a claimed file is fine");
    assert.equal(shell(p.root, "Bash", { command: "echo hi > src/about.js" }), false, "unclaimed files are free");
    assert.equal(shell(p.root, "Bash", { command: "npm test" }), false);
    assert.equal(shell(p.root, "Bash", { command: "npm run build > build.log 2>&1" }), false);

    assert.equal(shell(wt, "Bash", { command: "echo hi > src/home.js" }), false, "the builder writes its own file");
    assert.equal(shell(wt, "Bash", { command: "echo hi > src/about.js" }), true, "but not outside its item");
    assert.equal(shell(wt, "Bash", { command: "echo notes > docs/build/handoffs/ui-001.md" }), false, "its report is fine");

    assert.equal(shell(p.root, "Bash", { command: "cat .env" }), true, "secret protection is unchanged");
    assert.equal(checkToolCall("Bash", { command: "echo hi > src/home.js" }, { cwd: p.root, claims: false }).blocked, false, "and the claim check can still be switched off for self-tests");
  } finally {
    p.done();
  }
});

// ---------------------------------------------------------------------------
// AR-FIX-005: only the recovered item's own undone merge is brought back
// ---------------------------------------------------------------------------

test("AR-FIX-005: after an item is recovered, a later unrelated item merges normally", () => {
  const p = project([FAILS_ON_MAIN_UNTIL_FIXED]);
  try {
    board(p.root, "start", "ui-001", "--agent", "builder-1");
    commitIn(p.worktree("ui-001"), "src/home.js", "home\n", "feat(ui-001): home page");
    assert.match(board(p.root, "merge", "ui-001").stderr, /so the merge was undone/);
    commitIn(p.worktree("ui-001"), "FIXED", "\n", "fix(ui-001): make the checks pass");
    const recovered = board(p.root, "merge", "ui-001");
    assert.equal(recovered.code, 0, recovered.all);
    assert.match(recovered.stdout, /Brought back the work from the undone merge/);
    assert.ok(existsSync(path.join(p.root, "src", "home.js")) && existsSync(path.join(p.root, "FIXED")), "the recovered item has its feature and its fix");

    board(p.root, "start", "ui-002", "--agent", "builder-2");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");
    const next = board(p.root, "merge", "ui-002");
    assert.equal(next.code, 0, next.all);
    assert.doesNotMatch(next.all, /merged before|Brought back/, "nothing of ui-001 is replayed into it");
    assert.equal(readFileSync(path.join(p.root, "src", "home.js"), "utf8"), "home\n", "the recovered feature is still there");
    assert.equal(readFileSync(path.join(p.root, "src", "about.js"), "utf8"), "about\n", "and so is the new one");
    assert.equal(markOf(p.root, "ui-001"), "x");
    assert.equal(markOf(p.root, "ui-002"), "x");
    assert.doesNotMatch(entryOf(p.root, "ui-001"), /Merge undone/, "the recovery note is cleared once it merges");
  } finally {
    p.done();
  }
});

test("AR-FIX-005: an item merged while another is being recovered is left alone, and the recovery still brings everything back", () => {
  const p = project([HOME_FAILS_ON_MAIN_UNTIL_FIXED]);
  try {
    board(p.root, "start", "ui-001", "--agent", "builder-1");
    commitIn(p.worktree("ui-001"), "src/home.js", "home\n", "feat(ui-001): home page");
    assert.match(board(p.root, "merge", "ui-001").stderr, /so the merge was undone/);

    // Started from main after the undo, so its history holds the undone merge.
    board(p.root, "start", "ui-002", "--agent", "builder-2");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");
    const other = board(p.root, "merge", "ui-002");
    assert.equal(other.code, 0, other.all);
    assert.doesNotMatch(other.all, /merged before|Brought back/);
    assert.ok(!existsSync(path.join(p.root, "src", "home.js")), "ui-001's undone work stays off main");

    commitIn(p.worktree("ui-001"), "FIXED", "\n", "fix(ui-001): make the checks pass");
    const recovered = board(p.root, "merge", "ui-001");
    assert.equal(recovered.code, 0, recovered.all);
    assert.match(recovered.stdout, /Brought back the work from the undone merge/);
    for (const file of ["src/home.js", "FIXED", "src/about.js"]) assert.ok(existsSync(path.join(p.root, file)), `${file} is on main`);
  } finally {
    p.done();
  }
});

test("AR-FIX-005: an item undone and then built again from scratch gets none of the old work back", () => {
  const p = project(['node -e "process.exit(0)"']);
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");
    commitIn(p.worktree("ui-002"), "src/about.css", "a {}\n", "feat(ui-002): style it");
    assert.equal(board(p.root, "merge", "ui-002").code, 0);
    const out = board(p.root, "undo", "ui-002", "--yes");
    assert.equal(out.code, 0, out.all);

    board(p.root, "start", "ui-002", "--agent", "builder-2");
    commitIn(p.worktree("ui-002"), "src/about.js", "about, rebuilt\n", "feat(ui-002): about page, rebuilt");
    const rebuilt = board(p.root, "merge", "ui-002");
    assert.equal(rebuilt.code, 0, rebuilt.all);
    assert.doesNotMatch(rebuilt.all, /Brought back/);
    assert.equal(readFileSync(path.join(p.root, "src", "about.js"), "utf8"), "about, rebuilt\n");
    assert.ok(!existsSync(path.join(p.root, "src", "about.css")), "the undone styling stays undone");
  } finally {
    p.done();
  }
});

// A failed merge of ui-001, undone, with the builder's worktree kept.
function failedMergeOfHome(checks = [FAILS_ON_MAIN_UNTIL_FIXED]) {
  const p = project(checks);
  board(p.root, "start", "ui-001", "--agent", "builder-1");
  commitIn(p.worktree("ui-001"), "src/home.js", "home\n", "feat(ui-001): home page");
  assert.match(board(p.root, "merge", "ui-001").stderr, /so the merge was undone/);
  return p;
}

test("AR-FIX-005: the work comes back even when the builder rebased onto main after the undo, as its rules say", () => {
  const p = failedMergeOfHome();
  try {
    const wt = p.worktree("ui-001");
    commitIn(wt, "FIXED", "\n", "fix(ui-001): make the checks pass");
    git(wt, "rebase", "main");
    assert.ok(!existsSync(path.join(wt, "src", "home.js")), "the rebase took the work off the branch");

    const out = board(p.root, "merge", "ui-001");
    assert.equal(out.code, 0, out.all);
    assert.match(out.stdout, /Brought back the work from the undone merge/);
    assert.equal(readFileSync(path.join(p.root, "src", "home.js"), "utf8"), "home\n", "the original feature is on main");
    assert.ok(existsSync(path.join(p.root, "FIXED")), "and so is the fix");
    assert.equal(markOf(p.root, "ui-001"), "x");
  } finally {
    p.done();
  }
});

test("AR-FIX-005: the work comes back when the fix went onto main and the branch has nothing new", () => {
  const p = failedMergeOfHome();
  try {
    commitIn(p.root, "FIXED", "\n", "fix: make the checks pass on main");
    const out = board(p.root, "merge", "ui-001");
    assert.equal(out.code, 0, out.all);
    assert.ok(existsSync(path.join(p.root, "src", "home.js")));
  } finally {
    p.done();
  }
});

test("AR-FIX-005: work brought back once is not brought back again when the merge is retried", () => {
  const BROKEN_ANYWHERE = `node -e "const fs=require('fs');process.exit((fs.statSync('.git').isDirectory()&&!fs.existsSync('FIXED'))||fs.existsSync('BROKEN')?1:0)"`;
  const p = failedMergeOfHome([BROKEN_ANYWHERE]);
  try {
    const wt = p.worktree("ui-001");
    const undoneBy = git(p.root, "rev-parse", "HEAD");
    commitIn(wt, "FIXED", "\n", "fix(ui-001): make the checks pass");
    commitIn(wt, "BROKEN", "\n", "wip(ui-001): something else breaks");
    const second = board(p.root, "merge", "ui-001");
    assert.equal(second.code, 1);
    assert.match(second.stdout + second.stderr, /fails on agent\/ui-001, so it was not merged/);
    assert.ok(existsSync(path.join(wt, "src", "home.js")), "the work is back on the branch");

    git(wt, "rm", "-q", "BROKEN");
    git(wt, "commit", "-q", "-m", "fix(ui-001): unbreak");
    const third = board(p.root, "merge", "ui-001");
    assert.equal(third.code, 0, third.all);
    assert.doesNotMatch(third.stdout, /Brought back/, "already brought back, so not again");
    assert.equal(readFileSync(path.join(p.root, "src", "home.js"), "utf8"), "home\n");
    assert.equal(revertsOf(p.root, undoneBy), 1, "the undo was reversed exactly once");
  } finally {
    p.done();
  }
});

test("AR-FIX-005: bringing the work back stops cleanly on a real clash, changing nothing", () => {
  const p = failedMergeOfHome();
  try {
    const wt = p.worktree("ui-001");
    git(wt, "rebase", "main");
    commitIn(wt, "src/home.js", "home, written again differently\n", "feat(ui-001): home page again");
    const branchBefore = git(p.root, "rev-parse", "agent/ui-001");
    const mainBefore = git(p.root, "rev-parse", "main");

    const out = board(p.root, "merge", "ui-001");
    assert.equal(out.code, 1);
    assert.match(out.stderr, /Bringing that work back onto the branch hit a problem, so nothing was changed/);
    assert.match(out.stderr, /git revert --no-edit [0-9a-f]{7}/, "and says how to do it by hand");
    assert.equal(git(p.root, "rev-parse", "agent/ui-001"), branchBefore, "the branch is as it was");
    assert.equal(git(p.root, "rev-parse", "main"), mainBefore, "and so is main");
    assert.equal(git(wt, "rev-parse", "--abbrev-ref", "HEAD"), "agent/ui-001", "the worktree is back on its branch");
    assert.equal(git(wt, "status", "--porcelain"), "", "with nothing left half done");
  } finally {
    p.done();
  }
});

// ---------------------------------------------------------------------------
// AR-FIX-006: an undo that was itself reversed
// ---------------------------------------------------------------------------

// Runs the command undo prints for bringing the item back, as the operator would.
function restore(root, out, id) {
  const [, shas] = out.match(new RegExp(`To bring ${id} back as it was: git revert --no-edit ([0-9a-f ]+)`)) ?? [];
  assert.ok(shas, `undo says how to bring ${id} back:\n${out}`);
  git(root, "revert", "--no-edit", ...shas.trim().split(" "));
}

const revertsOf = (root, sha) => git(root, "log", "--format=%b%x1e").split("\x1e").filter((body) => body.includes(`This reverts commit ${sha}`)).length;

test("AR-FIX-006: an ordinary save point whose undo was reversed can be undone again, round after round", () => {
  const p = project(['node -e "process.exit(0)"']);
  try {
    setPlan(p.root, planOf(p.root).replace("- [ ] **ui-001**", "- [x] **ui-001**"));
    writeFileSync(path.join(p.root, "src", "home.js"), "home\n");
    git(p.root, "add", "-A");
    git(p.root, "commit", "-q", "-m", "feat(ui-001): home page");
    const feature = git(p.root, "rev-parse", "HEAD");
    commitIn(p.root, "src/about.js", "about\n", "feat(ui-002): about page");
    const home = path.join(p.root, "src", "home.js");

    for (let round = 1; round <= 3; round++) {
      const dry = board(p.root, "undo", "ui-001");
      assert.match(dry.stdout, new RegExp(`would add 1 new commit that reverses this save point:\\n {2}${feature.slice(0, 7)} {2}feat\\(ui-001\\): home page`), `round ${round}: the restored save point is offered`);
      const out = board(p.root, "undo", "ui-001", "--yes");
      assert.equal(out.code, 0, out.all);
      assert.ok(!existsSync(home), `round ${round}: removed`);
      assert.equal(markOf(p.root, "ui-001"), " ");
      assert.equal(revertsOf(p.root, feature), round, `round ${round}: reversed once more, not twice`);
      assert.match(board(p.root, "undo", "ui-001").stdout, /Nothing to undo for ui-001/);

      // The operator changes their mind and undoes the undo with plain git.
      restore(p.root, out.stdout, "ui-001");
      assert.equal(readFileSync(home, "utf8"), "home\n", `round ${round}: back again`);
      assert.equal(markOf(p.root, "ui-001"), "x", "the plan comes back with it");
      assert.equal(git(p.root, "status", "--porcelain"), "");
      assert.ok(existsSync(path.join(p.root, "src", "about.js")), "unrelated work is never touched");
    }
  } finally {
    p.done();
  }
});

test("AR-FIX-006: a merged item whose undo was reversed can be undone again, still one step per save point", () => {
  const p = project(['node -e "process.exit(0)"']);
  try {
    board(p.root, "start", "ui-002", "--agent", "builder-1");
    commitIn(p.worktree("ui-002"), "src/about.js", "about\n", "feat(ui-002): about page");
    commitIn(p.worktree("ui-002"), "src/about.css", "a {}\n", "feat(ui-002): style it");
    assert.equal(board(p.root, "merge", "ui-002").code, 0);
    const merged = git(p.root, "rev-parse", "HEAD");
    const builderCommits = git(p.root, "rev-list", `${merged}^1..${merged}^2`).split("\n");
    commitIn(p.root, "src/about.js", "about, reworded\n", "fix(ui-002): reword the about page");
    const fix = git(p.root, "rev-parse", "HEAD");
    commitIn(p.root, "src/home.js", "home\n", "feat(ui-001): home page");
    const about = path.join(p.root, "src", "about.js");

    for (let round = 1; round <= 2; round++) {
      const dry = board(p.root, "undo", "ui-002");
      assert.match(dry.stdout, /would add 2 new commits/, `round ${round}`);
      assert.match(dry.stdout, /fix\(ui-002\): reword the about page\n.*merge\(ui-002\): About page {2}\(a merge: undone in one step/);
      const out = board(p.root, "undo", "ui-002", "--yes");
      assert.equal(out.code, 0, out.all);
      assert.ok(!existsSync(about) && !existsSync(path.join(p.root, "src", "about.css")), `round ${round}: all of it is gone`);
      assert.equal(revertsOf(p.root, merged), round, "the merge is reversed once per undo");
      assert.equal(revertsOf(p.root, fix), round, "and so is the fix");
      for (const sha of builderCommits) assert.equal(revertsOf(p.root, sha), 0, "the builder's own commits are never reversed on their own");

      restore(p.root, out.stdout, "ui-002");
      assert.equal(readFileSync(about, "utf8"), "about, reworded\n", `round ${round}: back, fix included`);
      assert.equal(markOf(p.root, "ui-002"), "x", "the plan comes back with it");
      assert.equal(git(p.root, "status", "--porcelain"), "");
      assert.equal(readFileSync(path.join(p.root, "src", "home.js"), "utf8"), "home\n", "unrelated work is never touched");
    }
    assert.equal(board(p.root, "undo", "ui-002", "--yes").code, 0);
    assert.ok(!existsSync(about), "and a last undo removes it once more");
    assert.ok(existsSync(path.join(p.root, "src", "home.js")));
  } finally {
    p.done();
  }
});
