// The updater: it replaces agent-ready's own files, keeps the ones changed in
// the project, never touches the project's documents, and says what's new.
// Every test installs into a throwaway folder and updates from a local copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { changesBetween, compareVersions, fingerprint, RECORD } from "../skills/agent-ready/scripts/update.mjs";

const SKILL = fileURLToPath(new URL("../skills/agent-ready/", import.meta.url));
const VERSION = readFileSync(path.join(SKILL, "VERSION"), "utf8").trim();

// A project installed the way the setup installs one, with its version recorded.
function installed() {
  const base = mkdtempSync(path.join(os.tmpdir(), "agent-ready-upd-"));
  const root = path.join(base, "app");
  const agents = path.join(root, ".agents");
  mkdirSync(path.join(agents, "hooks"), { recursive: true });
  mkdirSync(path.join(agents, "scripts"), { recursive: true });
  for (const name of ["guard.mjs", "precommit-guard.mjs"]) cpSync(path.join(SKILL, "guards", name), path.join(agents, "hooks", name));
  for (const name of readdirSync(path.join(SKILL, "scripts"))) cpSync(path.join(SKILL, "scripts", name), path.join(agents, "scripts", name));
  cpSync(path.join(SKILL, "commands"), path.join(agents, "commands"), { recursive: true });
  cpSync(SKILL, path.join(agents, "skills", "agent-ready"), { recursive: true });
  cpSync(path.join(SKILL, "templates", "docs"), path.join(root, "docs"), { recursive: true });
  writeFileSync(path.join(root, "AGENTS.md"), "# AGENTS.md: test\n\n## Operator overrides (these win)\n\n- 2026-10-01: Never run checks before each commit.\n");
  mkdirSync(path.join(root, ".claude"), { recursive: true });
  mkdirSync(path.join(root, ".githooks"), { recursive: true });
  cpSync(path.join(SKILL, "guards", "git-pre-commit"), path.join(root, ".githooks", "pre-commit"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  node(root, ".agents/scripts/commands.mjs", "install");
  const recorded = node(root, ".agents/scripts/update.mjs", "--record");
  assert.equal(recorded.code, 0, recorded.out);
  return { base, root, done: () => rmSync(base, { recursive: true, force: true }) };
}

// A newer version of the skill: one script changed, one command added, one
// retired, the git hook changed (with Windows line endings), and a What's new entry.
function newerVersion(base, version = "1.1.0") {
  const repo = path.join(base, `source-${version}`);
  const skill = path.join(repo, "skills", "agent-ready");
  cpSync(SKILL, skill, { recursive: true });
  writeFileSync(path.join(skill, "VERSION"), `${version}\n`);
  writeFileSync(path.join(skill, "scripts", "keys.mjs"), `${readFileSync(path.join(SKILL, "scripts", "keys.mjs"), "utf8")}\n// changed in ${version}\n`);
  writeFileSync(path.join(skill, "commands", "ar-new.md"), "---\ndescription: A command that is new in this version.\n---\nDo the new thing.\n");
  unlinkSync(path.join(skill, "commands", "ar-explain.md"));
  writeFileSync(path.join(skill, "guards", "git-pre-commit"), "#!/bin/sh\r\n# changed\r\nnode .agents/hooks/precommit-guard.mjs || exit 1\r\n");
  const changes = readFileSync(path.join(SKILL, "CHANGES.md"), "utf8");
  const entry = `## ${version} (2026-11-01)\n\n- A new command.\n\n### For your documents\n\n- \`docs/rules/git.md\`: a new line.\n\n`;
  writeFileSync(path.join(skill, "CHANGES.md"), changes.replace(/^## /m, `${entry}## `));
  return repo;
}

function node(cwd, script, ...args) {
  const out = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { code: out.status, out: `${out.stdout}${out.stderr}` };
}

const update = (root, ...args) => node(root, ".agents/scripts/update.mjs", ...args);
const read = (root, file) => readFileSync(path.join(root, file), "utf8");
const record = (root) => JSON.parse(read(root, RECORD));

// Every file in the project except git's own, with its content, to prove nothing changed.
function snapshot(root) {
  const files = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name === ".git") continue;
      if (entry.isDirectory()) walk(full);
      else files[path.relative(root, full)] = readFileSync(full, "utf8");
    }
  };
  walk(root);
  return files;
}

test("versions compare as numbers, and What's new is cut to the versions in between", () => {
  assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
  assert.ok(compareVersions("v1.0.0", "1.0.0") === 0);
  assert.ok(compareVersions(null, "0.0.1") < 0, "no version is older than any version");
  const changes = "# What's new\n\n## 1.2.0\n\n- c\n\n## 1.1.0\n\n- b\n\n## 1.0.0\n\n- a\n";
  assert.deepEqual(changesBetween(changes, "1.0.0", "1.2.0"), ["## 1.2.0\n\n- c", "## 1.1.0\n\n- b"]);
  assert.equal(changesBetween(changes, null, "1.1.0").length, 2, "without a version, everything up to the new one");
  assert.match(readFileSync(path.join(SKILL, "CHANGES.md"), "utf8"), new RegExp(`^## ${VERSION.replace(/\./g, "\\.")} `, "m"), "CHANGES.md has an entry for the current version");
});

test("setup records the version and a fingerprint of each of agent-ready's own files", () => {
  const p = installed();
  try {
    const data = record(p.root);
    assert.equal(data.version, VERSION);
    assert.equal(data.source, "https://github.com/Bbhuva/agent-ready");
    for (const file of [".agents/hooks/guard.mjs", ".agents/scripts/update.mjs", ".agents/commands/ar-help.md", ".githooks/pre-commit"]) assert.ok(data.files[file], file);
    assert.equal(data.files[".agents/scripts/board.mjs"], fingerprint(readFileSync(path.join(SKILL, "scripts", "board.mjs"), "utf8")));
    assert.ok(!Object.keys(data.files).some((file) => file.startsWith("docs/") || file === "AGENTS.md"), "documents are never agent-ready's to replace");
  } finally {
    p.done();
  }
});

test("a dry run shows the versions, what's new and each file's fate, and changes nothing", () => {
  const p = installed();
  try {
    const before = snapshot(p.root);
    const out = update(p.root, "--from", newerVersion(p.base));
    assert.equal(out.code, 0, out.out);
    assert.match(out.out, new RegExp(`You have agent-ready ${VERSION.replace(/\./g, "\\.")}\\. The newest is 1\\.1\\.0`));
    assert.match(out.out, /What's new:\n\n## 1\.1\.0[\s\S]*### For your documents/);
    assert.doesNotMatch(out.out, new RegExp(`## ${VERSION.replace(/\./g, "\\.")} `), "only what is newer than the installed version");
    assert.match(out.out, /replace {2}\.agents\/scripts\/keys\.mjs/);
    assert.match(out.out, /add {6}\.agents\/commands\/ar-new\.md/);
    assert.match(out.out, /remove {3}\.agents\/commands\/ar-explain\.md \(no longer part of agent-ready\)/);
    assert.match(out.out, /Your documents are not touched/);
    assert.match(out.out, /To go ahead: node \.agents\/scripts\/update\.mjs --yes/);
    assert.deepEqual(snapshot(p.root), before, "nothing changed");
  } finally {
    p.done();
  }
});

test("--yes updates agent-ready's files, keeps the ones changed here, and leaves the documents alone", () => {
  const p = installed();
  try {
    const source = newerVersion(p.base);
    const edited = `${read(p.root, ".agents/scripts/board.mjs")}\n// a local tweak\n`;
    writeFileSync(path.join(p.root, ".agents", "scripts", "board.mjs"), edited);
    writeFileSync(path.join(p.root, ".agents", "commands", "my-own.md"), "---\ndescription: The operator's own command.\n---\nDo my thing.\n");
    const documents = Object.fromEntries(Object.entries(snapshot(p.root)).filter(([file]) => (file.startsWith("docs") || file === "AGENTS.md") && !file.endsWith("commands.md")));

    const out = update(p.root, "--yes", "--from", source);
    assert.equal(out.code, 0, out.out);
    assert.match(out.out, /Updated to agent-ready 1\.1\.0: 4 files changed/);
    assert.equal(read(p.root, ".agents/scripts/keys.mjs"), read(source, "skills/agent-ready/scripts/keys.mjs"), "an unchanged file gets the new version");
    assert.equal(read(p.root, ".agents/scripts/board.mjs"), edited, "a file changed here is kept");
    assert.match(out.out, /keep {5}\.agents\/scripts\/board\.mjs: you changed it/);
    assert.ok(existsSync(path.join(p.root, ".agents", "commands", "ar-new.md")) && existsSync(path.join(p.root, ".claude", "commands", "ar-new.md")), "new commands reach each tool");
    assert.ok(!existsSync(path.join(p.root, ".agents", "commands", "ar-explain.md")) && !existsSync(path.join(p.root, ".claude", "commands", "ar-explain.md")), "retired commands go");
    assert.ok(existsSync(path.join(p.root, ".agents", "commands", "my-own.md")), "the operator's own command stays");
    assert.doesNotMatch(read(p.root, ".githooks/pre-commit"), /\r/, "the git hook keeps Unix line endings");
    assert.equal(read(p.root, ".agents/skills/agent-ready/VERSION").trim(), "1.1.0", "the skill copy is the new version");
    for (const [file, text] of Object.entries(documents)) assert.equal(read(p.root, file), text, `${file} is untouched`);
    assert.match(out.out, /The guard passes its self-test\.\nThe commit check passes its self-test\./);

    const data = record(p.root);
    assert.equal(data.version, "1.1.0");
    assert.notEqual(data.files[".agents/scripts/board.mjs"], fingerprint(edited), "the kept file is still known as changed here");
    const again = update(p.root, "--from", source);
    assert.match(again.out, /You're up to date: agent-ready 1\.1\.0/);
  } finally {
    p.done();
  }
});

test("a project set up before version numbers is told, then updated in full", () => {
  const p = installed();
  try {
    unlinkSync(path.join(p.root, RECORD));
    unlinkSync(path.join(p.root, ".agents", "skills", "agent-ready", "VERSION"));
    writeFileSync(path.join(p.root, ".agents", "scripts", "board.mjs"), `${read(p.root, ".agents/scripts/board.mjs")}\n// an older version\n`);
    const source = newerVersion(p.base);

    const dry = update(p.root, "--from", source);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /You have agent-ready from before version numbers/);
    assert.match(dry.out, /no record of which version it has[\s\S]*If you changed one on purpose, say so/);
    assert.match(dry.out, /## 1\.1\.0[\s\S]*## 1\.0\.0/, "every entry of What's new");
    assert.match(dry.out, /replace {2}\.agents\/scripts\/board\.mjs/);

    const out = update(p.root, "--yes", "--from", source);
    assert.equal(out.code, 0, out.out);
    assert.equal(read(p.root, ".agents/scripts/board.mjs"), read(source, "skills/agent-ready/scripts/board.mjs"));
    assert.equal(record(p.root).version, "1.1.0");
  } finally {
    p.done();
  }
});

test("an older copy changes nothing, and a folder that isn't set up is refused", () => {
  const p = installed();
  try {
    const older = newerVersion(p.base, "0.9.0");
    const before = snapshot(p.root);
    const out = update(p.root, "--yes", "--from", older);
    assert.match(out.out, new RegExp(`has agent-ready ${VERSION.replace(/\./g, "\\.")}, which is newer than 0\\.9\\.0`));
    assert.deepEqual(snapshot(p.root), before);

    // Like a home folder: a .agents/ folder from a skills installer, but no project.
    const home = path.join(p.base, "home");
    mkdirSync(path.join(home, ".agents", "skills", "agent-ready"), { recursive: true });
    const refused = node(home, path.join(SKILL, "scripts", "update.mjs"), "--yes", "--from", older);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /not set up with agent-ready yet/);
    assert.deepEqual(readdirSync(path.join(home, ".agents", "skills", "agent-ready")), [], "nothing is written there");
  } finally {
    p.done();
  }
});

test("a project set up before 1.0.0 can update by running the downloaded updater", () => {
  const p = installed();
  try {
    unlinkSync(path.join(p.root, RECORD));
    unlinkSync(path.join(p.root, ".agents", "scripts", "update.mjs")); // old setups don't have it
    const source = newerVersion(p.base);
    const downloaded = path.join(source, "skills", "agent-ready", "scripts", "update.mjs");
    const dry = node(p.root, downloaded, "--from", source);
    assert.ok(dry.out.includes(`To go ahead: node "${path.resolve(downloaded)}" --yes`), "it names the updater that is running, not one the project lacks");
    const out = node(p.root, downloaded, "--yes", "--from", source);
    assert.equal(out.code, 0, out.out);
    assert.ok(existsSync(path.join(p.root, ".agents", "scripts", "update.mjs")), "now it has the updater");
    assert.equal(record(p.root).version, "1.1.0");
  } finally {
    p.done();
  }
});
