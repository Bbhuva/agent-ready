import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { install, loadCommands, MARK } from "../skills/agent-ready/scripts/commands.mjs";

const SKILL = fileURLToPath(new URL("../skills/agent-ready/", import.meta.url));
const SCRIPT = path.join(SKILL, "scripts", "commands.mjs");
const COUNT = readdirSync(path.join(SKILL, "commands")).filter((file) => file.endsWith(".md")).length;

function project(...toolFolders) {
  const root = mkdtempSync(path.join(os.tmpdir(), "agent-ready-cmd-"));
  cpSync(path.join(SKILL, "commands"), path.join(root, ".agents", "commands"), { recursive: true });
  mkdirSync(path.join(root, "docs", "operator"), { recursive: true });
  for (const folder of toolFolders) mkdirSync(path.join(root, folder), { recursive: true });
  return root;
}

test("commands load in a sensible order, help first", () => {
  const root = project();
  const names = loadCommands(root).map((c) => c.name);
  assert.equal(names.length, COUNT);
  assert.equal(names[0], "ar-help");
  assert.deepEqual(names.slice(2, 5), ["ar-next", "ar-run", "ar-test"], "running and testing sit with the everyday loop");
  assert.equal(names.at(-1), "ar-update");
  assert.ok(names.includes("ar-status") && names.includes("ar-undo") && names.includes("ar-coordinate"));
  for (const c of loadCommands(root)) assert.ok(c.description.length > 10, c.name);
});

test("install writes each tool's own format for the tools set up here", () => {
  const root = project(".claude", ".cursor", ".gemini", ".opencode");
  const result = install(root);
  assert.equal(result.ok, true, result.message);

  const claude = readFileSync(path.join(root, ".claude", "commands", "ar-undo.md"), "utf8");
  assert.match(claude, /^---\ndescription: "Go back to before a finished item/);
  assert.match(claude, /\nargument-hint: "\[item ID\]"\n/);
  assert.match(claude, /\ndisable-model-invocation: true\n---\n/, "commands don't cost context until typed");
  assert.match(claude, /\$ARGUMENTS/);

  const gemini = readFileSync(path.join(root, ".gemini", "commands", "ar-undo.toml"), "utf8");
  assert.match(gemini, /^# made by agent-ready/);
  assert.match(gemini, /\ndescription = "Go back to before a finished item, without losing anything\."\nprompt = """\n/);
  assert.match(gemini, /\{\{args\}\}/);
  assert.doesNotMatch(gemini, /\$ARGUMENTS/);
  assert.match(gemini, /"""\n$/);

  const cursor = readFileSync(path.join(root, ".cursor", "commands", "ar-undo.md"), "utf8");
  assert.match(cursor, /# \/ar-undo/);
  assert.doesNotMatch(cursor, /\$ARGUMENTS/);

  const opencode = readFileSync(path.join(root, ".opencode", "commands", "ar-undo.md"), "utf8");
  assert.match(opencode, /^---\ndescription: /);
  assert.match(opencode, /\$ARGUMENTS/);

  for (const dir of [".claude/commands", ".cursor/commands", ".gemini/commands", ".opencode/commands"]) assert.equal(readdirSync(path.join(root, dir)).length, COUNT, dir);
  const doc = readFileSync(path.join(root, "docs", "operator", "commands.md"), "utf8");
  assert.match(doc, /\| `\/ar-help` \|/);
  assert.match(doc, /Claude Code, Cursor, Gemini CLI, OpenCode/);
  rmSync(root, { recursive: true, force: true });
});

test("install only touches tools that are set up, unless told which", () => {
  const root = project(".claude");
  install(root);
  assert.ok(existsSync(path.join(root, ".claude", "commands", "ar-help.md")));
  assert.ok(!existsSync(path.join(root, ".cursor")));
  install(root, { tools: ["gemini"] });
  assert.ok(existsSync(path.join(root, ".gemini", "commands", "ar-help.toml")));
  assert.equal(install(root, { tools: ["notepad"] }).ok, false);
  rmSync(root, { recursive: true, force: true });
});

test("install never overwrites the person's own command, and tidies up old ones", () => {
  const root = project(".claude");
  mkdirSync(path.join(root, ".claude", "commands"), { recursive: true });
  writeFileSync(path.join(root, ".claude", "commands", "ar-status.md"), "my own status command\n");
  writeFileSync(path.join(root, ".claude", "commands", "ar-gone.md"), `<!-- ${MARK} -->\nold\n`);
  writeFileSync(path.join(root, ".claude", "commands", "deploy.md"), "someone else's command\n");
  const result = install(root);
  assert.match(result.message, /Kept your own files: ar-status\.md/);
  assert.equal(readFileSync(path.join(root, ".claude", "commands", "ar-status.md"), "utf8"), "my own status command\n");
  assert.ok(!existsSync(path.join(root, ".claude", "commands", "ar-gone.md")), "a command that no longer exists is removed");
  assert.ok(existsSync(path.join(root, ".claude", "commands", "deploy.md")), "other commands are left alone");
  rmSync(root, { recursive: true, force: true });
});

test("Codex commands go to the home folder only when asked", () => {
  const root = project(".claude");
  const codexHome = mkdtempSync(path.join(os.tmpdir(), "agent-ready-codex-"));
  const before = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  try {
    install(root);
    assert.ok(!existsSync(path.join(codexHome, "prompts")));
    const result = install(root, { codex: true });
    assert.match(result.message, /\/prompts:ar-help/);
    assert.match(readFileSync(path.join(codexHome, "prompts", "ar-next.md"), "utf8"), /^---\ndescription: /);
  } finally {
    if (before === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = before;
    rmSync(root, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test("the list shows every command and how to type them anywhere", () => {
  const root = project(".claude");
  install(root);
  const out = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^agent-ready commands/);
  assert.match(out.stdout, /\/ar-help +List every agent-ready command/);
  assert.match(out.stdout, /\/ar-undo \[item ID\] +Go back/);
  assert.match(out.stdout, /Installed for: Claude Code/);
  assert.match(out.stdout, /type the name without the slash/);
  assert.equal(out.stdout.match(/^ {2}\/ar-/gm).length, COUNT);
  rmSync(root, { recursive: true, force: true });
});
