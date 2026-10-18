import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { keyStatus, saveKey } from "../skills/agent-ready/scripts/keys.mjs";
import { runHealth } from "../skills/agent-ready/scripts/health.mjs";

const SKILL = fileURLToPath(new URL("../skills/agent-ready/", import.meta.url));
const KEYS = path.join(SKILL, "scripts", "keys.mjs");
const HEALTH = path.join(SKILL, "scripts", "health.mjs");
// Made up, and shaped so no secret scanner mistakes it for a real key.
const FAKE_VALUE = "made-up-value-that-must-never-be-printed";

function folder() {
  return mkdtempSync(path.join(os.tmpdir(), "agent-ready-keys-"));
}

test("keyStatus reports names only: set, missing, optional and unlisted", () => {
  const root = folder();
  writeFileSync(path.join(root, ".env.example"), "STRIPE_SECRET_KEY=\nDATABASE_URL=\nSENTRY_DSN= # optional\n");
  writeFileSync(path.join(root, ".env"), `STRIPE_SECRET_KEY=${FAKE_VALUE}\nDATABASE_URL=\nEXTRA_THING="x"\n`);
  const status = keyStatus(root);
  assert.deepEqual(status.set, ["STRIPE_SECRET_KEY"]);
  assert.deepEqual(status.missing, ["DATABASE_URL"]);
  assert.deepEqual(status.optionalMissing, ["SENTRY_DSN"]);
  assert.deepEqual(status.unlisted, ["EXTRA_THING"]);
  assert.ok(!JSON.stringify(status).includes(FAKE_VALUE), "no value ever leaves keyStatus");
});

test("the key check never prints a value, and fails while a key is missing", () => {
  const root = folder();
  writeFileSync(path.join(root, ".env.example"), "STRIPE_SECRET_KEY=\nDATABASE_URL=\n");
  writeFileSync(path.join(root, ".env.local"), `STRIPE_SECRET_KEY=${FAKE_VALUE}\n`);
  const out = spawnSync(process.execPath, [KEYS], { cwd: root, encoding: "utf8" });
  assert.equal(out.status, 1);
  assert.ok(!out.stdout.includes(FAKE_VALUE) && !out.stderr.includes(FAKE_VALUE));
  assert.match(out.stdout, /set {6}STRIPE_SECRET_KEY/);
  assert.match(out.stdout, /MISSING {2}DATABASE_URL/);
  assert.match(out.stdout, /keys\.mjs add DATABASE_URL/);
  writeFileSync(path.join(root, ".env.local"), `STRIPE_SECRET_KEY=${FAKE_VALUE}\nDATABASE_URL=postgres://x\n`);
  const done = spawnSync(process.execPath, [KEYS, "check"], { cwd: root, encoding: "utf8" });
  assert.equal(done.status, 0);
  assert.match(done.stdout, /Every required key is set/);
});

test("adding a key refuses to run without a real terminal, so agents can't type keys in", () => {
  const root = folder();
  writeFileSync(path.join(root, ".env.example"), "STRIPE_SECRET_KEY=\n");
  writeFileSync(path.join(root, ".gitignore"), ".env\n");
  const out = spawnSync(process.execPath, [KEYS, "add", "STRIPE_SECRET_KEY"], { cwd: root, input: `${FAKE_VALUE}\n`, encoding: "utf8" });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /your own terminal/);
  assert.throws(() => readFileSync(path.join(root, ".env"), "utf8"), "nothing was written");
});

test("saveKey replaces or appends the line and quotes awkward values", () => {
  const root = folder();
  const file = path.join(root, ".env");
  writeFileSync(file, "A=1\nB=2\n");
  saveKey(file, "B", "new");
  saveKey(file, "C", 'has space "and quotes"');
  assert.equal(readFileSync(file, "utf8"), 'A=1\nB=new\nC="has space \\"and quotes\\""\n');
});

// A project set up the way the skill sets one up: templates copied, blanks
// filled, guards and scripts installed, git with .env ignored.
function setUpProject() {
  const root = folder();
  cpSync(path.join(SKILL, "templates", "docs"), path.join(root, "docs"), { recursive: true });
  writeFileSync(path.join(root, "AGENTS.md"), "# AGENTS.md: test\n\nA short, filled-in map.\n");
  writeFileSync(path.join(root, "CLAUDE.md"), "# CLAUDE.md\n\n@AGENTS.md\n");
  writeFileSync(path.join(root, ".gitignore"), ".env\n.env.*\n!.env.example\n");
  writeFileSync(path.join(root, ".env.example"), "STRIPE_SECRET_KEY=\n");
  mkdirSync(path.join(root, ".agents", "hooks"), { recursive: true });
  mkdirSync(path.join(root, ".agents", "scripts"), { recursive: true });
  for (const name of ["guard.mjs", "precommit-guard.mjs"]) cpSync(path.join(SKILL, "guards", name), path.join(root, ".agents", "hooks", name));
  for (const name of ["board.mjs", "keys.mjs", "health.mjs", "commands.mjs"]) cpSync(path.join(SKILL, "scripts", name), path.join(root, ".agents", "scripts", name));
  mkdirSync(path.join(root, ".claude"), { recursive: true });
  cpSync(path.join(SKILL, "tool-configs", "claude-settings.json"), path.join(root, ".claude", "settings.json"));
  cpSync(path.join(SKILL, "commands"), path.join(root, ".agents", "commands"), { recursive: true });
  spawnSync(process.execPath, [path.join(root, ".agents", "scripts", "commands.mjs"), "install"], { cwd: root });
  spawnSync("git", ["init", "-q"], { cwd: root });
  mkdirSync(path.join(root, ".githooks"), { recursive: true });
  cpSync(path.join(SKILL, "guards", "git-pre-commit"), path.join(root, ".githooks", "pre-commit"));
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root });
  return root;
}

test("health passes the core checks on a fresh setup and names what is left", () => {
  const root = setUpProject();
  try {
    const results = runHealth(root);
    const find = (re) => results.find((r) => re.test(r.title));
    assert.equal(find(/short map/)?.status, "ok");
    assert.equal(find(/self-test/)?.status, "ok");
    assert.equal(find(/guard runs in: Claude Code/)?.status, "ok");
    assert.equal(find(/checked for secrets/)?.status, "ok");
    assert.equal(find(/\.env is kept out of git/)?.status, "ok");
    assert.equal(find(/documents only/)?.status, "ok");
    assert.equal(find(/plans check out/)?.status, "ok");
    assert.equal(find(/rules and working docs are there/)?.status, "ok");
    assert.equal(find(/\/ar- commands in Claude Code/)?.status, "ok");
    const installed = spawnSync(process.execPath, [path.join(root, ".agents", "scripts", "health.mjs")], { cwd: root, encoding: "utf8" });
    assert.match(installed.stdout, /Health: /, "the installed copy runs on its own, with its neighbours");
    assert.equal(find(/key is not set/)?.status, "warn", "the missing key is named");
    const blanks = find(/blanks to fill in/);
    assert.equal(blanks?.status, "warn", "template blanks in docs are flagged");
    assert.doesNotMatch(blanks.detail, /decisions\.md/, "blanks inside code examples don't count");
    assert.ok(!results.some((r) => r.status === "fail"), JSON.stringify(results.filter((r) => r.status === "fail")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("health fails on code in docs/, an unfilled map and a tool without the guard", () => {
  const root = setUpProject();
  try {
    writeFileSync(path.join(root, "docs", "helper.js"), "export {};\n");
    writeFileSync(path.join(root, "AGENTS.md"), "# AGENTS.md: {{PROJECT_NAME}}\n");
    mkdirSync(path.join(root, ".cursor"), { recursive: true });
    const out = spawnSync(process.execPath, [HEALTH], { cwd: root, encoding: "utf8" });
    assert.equal(out.status, 1);
    assert.match(out.stdout, /FIX +Code is sitting in docs\/\n +docs\/helper\.js/);
    assert.match(out.stdout, /FIX +AGENTS\.md still has blanks/);
    assert.match(out.stdout, /FIX +Cursor is set up here but does not run the guard/);
    assert.match(out.stdout, /Health: \d+ of \d+ OK, \d+ to fix/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("health on an empty folder says the setup is missing", () => {
  const root = folder();
  const results = runHealth(root);
  assert.equal(results.find((r) => /AGENTS\.md is missing/.test(r.title))?.status, "fail");
  assert.equal(results.find((r) => /guard is not installed/.test(r.title))?.status, "fail");
});
