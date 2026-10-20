import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GUARDS = fileURLToPath(new URL("../skills/agent-ready/guards/", import.meta.url));

function makeRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "agent-ready-git-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  mkdirSync(path.join(dir, ".agents", "hooks"), { recursive: true });
  cpSync(path.join(GUARDS, "guard.mjs"), path.join(dir, ".agents", "hooks", "guard.mjs"));
  cpSync(path.join(GUARDS, "precommit-guard.mjs"), path.join(dir, ".agents", "hooks", "precommit-guard.mjs"));
  return { dir, git };
}

function check(dir, ...args) {
  return spawnSync(process.execPath, [".agents/hooks/precommit-guard.mjs", ...args], { cwd: dir, encoding: "utf8" });
}

test("a clean staged change passes", () => {
  const { dir, git } = makeRepo();
  writeFileSync(path.join(dir, "app.js"), "const key = process.env.API_KEY;\n");
  git("add", "app.js");
  assert.equal(check(dir).status, 0);
});

test("a staged .env file is refused", () => {
  const { dir, git } = makeRepo();
  writeFileSync(path.join(dir, ".env"), "API_KEY=abc\n");
  git("add", "-f", ".env");
  const out = check(dir);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /\.env: this file holds secrets/);
});

test("a staged .env.example is fine", () => {
  const { dir, git } = makeRepo();
  writeFileSync(path.join(dir, ".env.example"), "API_KEY=\n");
  git("add", ".env.example");
  assert.equal(check(dir).status, 0);
});

test("a hardcoded key is refused with file and line, and the key is masked", () => {
  const { dir, git } = makeRepo();
  const fakeKey = "AKIA" + "QWERTYUIOPASDFGH";
  writeFileSync(path.join(dir, "config.js"), `// config\nexport const aws = "${fakeKey}";\n`);
  git("add", "config.js");
  const out = check(dir);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /config\.js:2: looks like an AWS access key/);
  assert.doesNotMatch(out.stderr, new RegExp(fakeKey));
});

test("--scan-repo finds keys already committed", () => {
  const { dir, git } = makeRepo();
  writeFileSync(path.join(dir, "old.py"), `STRIPE = "${"sk_" + "live_" + "Zx9Yw8Vu7Ts6Rq5Po4"}"\n`);
  git("add", "old.py");
  git("commit", "-q", "-m", "old", "--no-verify");
  const out = check(dir, "--scan-repo");
  assert.equal(out.status, 1);
  assert.match(out.stderr, /old\.py:1: looks like a Stripe live key/);
});

test("--scan-repo on a clean repo says so", () => {
  const { dir, git } = makeRepo();
  writeFileSync(path.join(dir, "readme.md"), "Put your key in .env\n");
  git("add", "readme.md");
  git("commit", "-q", "-m", "docs", "--no-verify");
  const out = check(dir, "--scan-repo");
  assert.equal(out.status, 0);
  assert.match(out.stdout, /no secret files or real-looking keys/);
});

test("the git hook file blocks a real commit", () => {
  const { dir, git } = makeRepo();
  mkdirSync(path.join(dir, ".githooks"));
  cpSync(path.join(GUARDS, "git-pre-commit"), path.join(dir, ".githooks", "pre-commit"));
  try {
    execFileSync("chmod", ["+x", path.join(dir, ".githooks", "pre-commit")]);
  } catch {
    // Windows git runs hooks without the executable bit.
  }
  git("config", "core.hooksPath", ".githooks");
  writeFileSync(path.join(dir, ".env.production"), "DB=secret\n");
  git("add", "-f", ".env.production");
  const commit = spawnSync("git", ["commit", "-m", "oops"], { cwd: dir, encoding: "utf8" });
  assert.notEqual(commit.status, 0);
  assert.match(commit.stderr, /agent-ready stopped this commit/);
});

test("--decoy-test proves a secret file is refused, prints PASS, and stages nothing real", () => {
  const { dir, git } = makeRepo();
  const empty = check(dir, "--decoy-test");
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /^PASS {2}A commit that adds a secret file is refused/, "works before the first commit too");

  writeFileSync(path.join(dir, "app.js"), "x\n");
  git("add", "app.js");
  git("commit", "-q", "-m", "first");
  writeFileSync(path.join(dir, "next.js"), "y\n");
  git("add", "next.js");
  const out = check(dir, "--decoy-test");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^PASS/);
  assert.equal(git("diff", "--cached", "--name-only").trim(), "next.js", "the real staging area is untouched");
  assert.ok(!existsSync(path.join(dir, ".env.agent-ready-check")), "no decoy file is left in the project");
  assert.ok(!readdirSync(path.join(dir, ".git")).some((name) => name.includes("agent-ready-decoy")), "the throwaway staging area is removed");
});
