import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claimsFile, loadBoard, parseItems, pathsOverlap, readyItems, review } from "../skills/agent-ready/scripts/board.mjs";

const BOARD = fileURLToPath(new URL("../skills/agent-ready/scripts/board.mjs", import.meta.url));

const PHASE_1 = `# Phase 1: skeleton

## Iteration A: base

- [x] **ops-001** Project skeleton \`task · S · Must\`
  - **Depends:** none
  - **Touches:** \`package.json\`, \`src/\`

## Iteration B: sign in

- [ ] **auth-001** Sign up \`story · M · Must\`
  - **Depends:** ops-001, op-001
  - **Touches:** \`src/app/(auth)/\`, \`src/lib/auth.ts\`
- [ ] **auth-002** Sign in \`story · M · Must\`
  - **Depends:** ops-001
  - **Touches:** \`src/lib/auth.ts\`
- [ ] **ui-001** Home page \`story · S · Should\`
  - **Depends:** ops-001
  - **Touches:** \`src/app/page.tsx\`, \`src/app/[slug]/page.tsx\`
`;

const PHASE_2 = `# Phase 2: lists

## Iteration A: lists

- [ ] **list-001** Make a list \`story · M · Must\`
  - **Depends:** auth-002
  - **Touches:** \`src/app/lists/\`
`;

const TODO = `# Your to-do list

\`\`\`markdown
- [ ] **op-999** An example inside a code block, not a real entry
\`\`\`

## Waiting on you

- [ ] **op-001** Create the Supabase project \`sign up\`
  - **Why:** the app needs a database.
`;

function project(files = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "agent-ready-board-"));
  const all = {
    "docs/build/phases/phase-1-skeleton/plan.md": PHASE_1,
    "docs/build/phases/phase-2-lists/plan.md": PHASE_2,
    "docs/operator/todo.md": TODO,
    "docs/build/backlog.md": "# Backlog\n\n## Next up\n\n- [ ] **idea-001** Dark mode\n",
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    if (text === null) continue;
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}

function run(cwd, ...args) {
  const out = spawnSync(process.execPath, [BOARD, ...args], { cwd, encoding: "utf8" });
  return { code: out.status, stdout: out.stdout, stderr: out.stderr };
}

function git(cwd, ...args) {
  const out = spawnSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  return out.stdout.trim();
}

test("parseItems reads the item format and skips examples in code blocks", () => {
  const items = parseItems(PHASE_1 + "\n```markdown\n- [ ] **fake-001** Example\n```\n", { phase: "phase-1-skeleton", order: 1 });
  assert.deepEqual(items.map((item) => item.id), ["ops-001", "auth-001", "auth-002", "ui-001"]);
  const signUp = items[1];
  assert.equal(signUp.status, "todo");
  assert.equal(signUp.title, "Sign up");
  assert.equal(signUp.tag, "story · M · Must");
  assert.deepEqual(signUp.depends, ["ops-001", "op-001"]);
  assert.deepEqual(signUp.touches, ["src/app/(auth)/", "src/lib/auth.ts"]);
  assert.equal(signUp.iteration, "Iteration B: sign in");
  assert.equal(items[0].status, "done");
});

test("pathsOverlap is strict about folders and careful with globs", () => {
  assert.ok(pathsOverlap("src/lib/auth.ts", "src/lib/auth.ts"));
  assert.ok(pathsOverlap("src/lib/", "src/lib/auth.ts"));
  assert.ok(pathsOverlap("./src/lib", "src\\lib\\auth.ts"));
  assert.ok(pathsOverlap("SRC/Lib/auth.ts", "src/lib/auth.ts"), "case-insensitive file systems");
  assert.ok(pathsOverlap("src/auth*", "src/authz.ts"), "a glob covers its folder");
  assert.ok(pathsOverlap("**/*.ts", "anything/at/all.md"), "a glob from the root overlaps everything");
  assert.ok(!pathsOverlap("src/app", "src/application"));
  assert.ok(!pathsOverlap("src/app/page.tsx", "src/app/[slug]/page.tsx"), "brackets are folder names, not globs");
  assert.ok(!pathsOverlap("apps/web/", "apps/mobile/"));
});

test("status shows what is ready, waiting and owed by the operator", () => {
  const root = project();
  const out = run(root);
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stdout, /Current phase: phase-1-skeleton \(1 of 4 done\)/);
  assert.match(out.stdout, /Ready now \(2\):\n {2}auth-002/);
  assert.match(out.stdout, /auth-001 {2}Sign up: it waits on op-001 \(todo\)/);
  assert.match(out.stdout, /Waiting on the operator \(1\):\n {2}op-001 {2}Create the Supabase project/);
  assert.doesNotMatch(out.stdout, /op-999/);
  const ready = readyItems(loadBoard(root)).map((item) => item.id);
  assert.deepEqual(ready, ["auth-002", "ui-001"], "later phases wait for the current one");
});

test("a claim blocks the same item and overlapping files, and release frees them", () => {
  const root = project({ "docs/operator/todo.md": TODO.replace("- [ ] **op-001**", "- [x] **op-001**") });
  assert.equal(run(root, "claim", "auth-002", "--agent", "codex-1").code, 0);

  const again = run(root, "claim", "auth-002", "--agent", "claude-1");
  assert.equal(again.code, 1);
  assert.match(again.stderr, /codex-1 has claimed it/);

  const overlap = run(root, "claim", "auth-001", "--agent", "claude-1");
  assert.equal(overlap.code, 1);
  assert.match(overlap.stderr, /codex-1 is working on auth-002, which touches the same files \(src\/lib\/auth\.ts\)/);

  assert.equal(run(root, "claim", "ui-001", "--agent", "claude-1").code, 0, "separate files are fine");
  assert.equal(run(root, "release", "auth-002").code, 0);
  assert.equal(run(root, "claim", "auth-001", "--agent", "claude-1").code, 0);
  assert.ok(existsSync(path.join(root, ".agents", "claims.json")), "outside git, claims live in .agents/");
});

test("claims need a name, a real item, done dependencies and the current phase", () => {
  const root = project();
  assert.match(run(root, "claim", "auth-002").stderr, /--agent <name>/);
  assert.match(run(root, "claim", "nope-001", "--agent", "a").stderr, /no item nope-001/);
  assert.match(run(root, "claim", "auth-001", "--agent", "a").stderr, /waits on op-001/);
  assert.match(run(root, "claim", "list-001", "--agent", "a").stderr, /current phase is phase-1-skeleton/);
  assert.match(run(root, "claim", "idea-001", "--agent", "a").stderr, /in the backlog/);
  assert.match(run(root, "claim", "op-001", "--agent", "a").stderr, /operator to-do/);
});

test("an item marked [~] in a plan counts as work in progress", () => {
  const root = project({
    "docs/build/phases/phase-1-skeleton/plan.md": PHASE_1.replace("- [ ] **auth-002**", "- [~] **auth-002**").replace(
      "  - **Touches:** `src/lib/auth.ts`",
      "  - **Touches:** `src/lib/auth.ts`\n  - **Claimed:** cursor, 2026-10-17 10:00",
    ),
    "docs/operator/todo.md": TODO.replace("- [ ] **op-001**", "- [x] **op-001**"),
  });
  const out = run(root, "claim", "auth-001", "--agent", "codex-1");
  assert.equal(out.code, 1);
  assert.match(out.stderr, /cursor is working on auth-002/);
});

test("check finds circles, unknown and misplaced dependencies, and duplicate IDs", () => {
  const broken = `# Phase 1

## Iteration A: one

- [ ] **a-001** First \`task · S · Must\`
  - **Depends:** a-002
  - **Touches:** \`a/\`
- [ ] **a-002** Second \`task · S · Must\`
  - **Depends:** a-001
  - **Touches:** \`b/\`

## Iteration B: two

- [ ] **a-003** Third \`task · S · Must\`
  - **Depends:** ghost-001, list-001, idea-001
  - **Touches:** \`c/\`
- [ ] **a-003** Third again \`task · S · Must\`
  - **Touches:** \`d/\`
`;
  const root = project({ "docs/build/phases/phase-1-skeleton/plan.md": broken });
  const out = run(root, "check");
  assert.equal(out.code, 1);
  assert.match(out.stderr, /a-003 is used twice/);
  assert.match(out.stderr, /a-001 depends on a-002 in the same iteration/);
  assert.match(out.stderr, /round in a circle: a-001 -> a-002 -> a-001/);
  assert.match(out.stderr, /depends on ghost-001, which is not in any plan/);
  assert.match(out.stderr, /depends on list-001, which is in phase-2-lists/);
  assert.match(out.stderr, /depends on idea-001, which is in backlog/);
});

test("check passes on good plans and flags stale and leftover claims", () => {
  const root = project({ "docs/operator/todo.md": TODO.replace("- [ ] **op-001**", "- [x] **op-001**") });
  assert.equal(run(root, "check").code, 0);
  mkdirSync(path.join(root, ".agents"), { recursive: true });
  writeFileSync(
    path.join(root, ".agents", "claims.json"),
    JSON.stringify({ "auth-002": { agent: "codex-1", at: "2026-01-01T00:00:00.000Z", touches: ["src/lib/auth.ts"] }, "ops-001": { agent: "old", at: new Date().toISOString(), touches: [] } }),
  );
  const { warnings, problems } = review(loadBoard(root));
  assert.deepEqual(problems, []);
  assert.ok(warnings.some((w) => /codex-1 claimed auth-002 .* stale/.test(w)));
  assert.ok(warnings.some((w) => /ops-001 is done but still claimed by old/.test(w)));
});

test("graph writes a Mermaid picture and a who-touches-what table", () => {
  const root = project();
  run(root, "claim", "auth-002", "--agent", "codex-1");
  assert.equal(run(root, "graph").code, 0);
  const graph = readFileSync(path.join(root, "docs", "build", "graph.md"), "utf8");
  assert.match(graph, /```mermaid\ngraph LR/);
  assert.match(graph, /ops_001\["ops-001: Project skeleton"\]:::done/);
  assert.match(graph, /auth_002\["auth-002: Sign in"\]:::doing/);
  assert.match(graph, /op_001\["op-001: Create the Supabase project"\]:::operator/);
  assert.match(graph, /op_001 --> auth_001/);
  assert.match(graph, /\| `src\/lib\/auth\.ts` \| auth-001 \(todo\), auth-002 \(doing\) \|/);
});

test("worktrees of one repo share claims, so parallel agents cannot collide", () => {
  const root = project({ "docs/operator/todo.md": TODO.replace("- [ ] **op-001**", "- [x] **op-001**") });
  const worktree = `${root}-wt`;
  try {
    git(root, "init", "-q");
    git(root, "add", "docs");
    git(root, "commit", "-q", "-m", "plans");
    git(root, "worktree", "add", "-q", worktree, "-b", "agent/ui-001");
    assert.equal(claimsFile(root), claimsFile(worktree), "one claims file for every worktree");
    assert.ok(claimsFile(root).includes(`${path.sep}.git${path.sep}agent-ready${path.sep}`));

    assert.equal(run(root, "claim", "auth-002", "--agent", "codex-1").code, 0);
    const fromWorktree = run(worktree, "claim", "auth-001", "--agent", "claude-1");
    assert.equal(fromWorktree.code, 1);
    assert.match(fromWorktree.stderr, /codex-1 is working on auth-002/);
    assert.equal(run(worktree, "claim", "ui-001", "--agent", "claude-1").code, 0);
    assert.doesNotMatch(git(root, "status", "--porcelain"), /claims/, "claims are never committed");
  } finally {
    rmSync(worktree, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("outside a project it says where to run it", () => {
  const empty = mkdtempSync(path.join(os.tmpdir(), "agent-ready-empty-"));
  const out = run(empty);
  assert.equal(out.code, 1);
  assert.match(out.stderr, /No docs\/build folder/);
});
