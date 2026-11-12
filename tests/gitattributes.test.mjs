// agent-ready's block in .gitattributes: its files keep LF line endings, so
// Git on Windows (core.autocrlf=true) doesn't print a warning for each file
// the setup wrote. The person's own lines and files are never changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeAttributes } from "../skills/agent-ready/scripts/update.mjs";

const SKILL = fileURLToPath(new URL("../skills/agent-ready/", import.meta.url));
const UPDATER = path.join(SKILL, "scripts", "update.mjs");
const TEMPLATE = readFileSync(path.join(SKILL, "templates", "gitattributes.txt"), "utf8");
const RULES = TEMPLATE.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim() && !line.startsWith("#"));
const START = "# agent-ready start";
const END = "# agent-ready end";

function project() {
  const base = mkdtempSync(path.join(os.tmpdir(), "agent-ready-attr-"));
  const root = path.join(base, "app");
  mkdirSync(root);
  return { base, root, done: () => rmSync(base, { recursive: true, force: true }) };
}

function node(cwd, script, ...args) {
  const out = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { code: out.status, out: `${out.stdout}${out.stderr}` };
}

const write = (root, file, text) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
};
const attributes = (root) => readFileSync(path.join(root, ".gitattributes"), "utf8");
const count = (text, line) => text.split(/\r?\n/).filter((l) => l === line).length;
const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

test("the template is one marked block, and the updater can check every document line", () => {
  const lines = TEMPLATE.replace(/\r\n/g, "\n").trimEnd().split("\n");
  assert.equal(lines[0], START);
  assert.equal(lines.at(-1), END);
  assert.equal(count(TEMPLATE, START) + count(TEMPLATE, END), 2);
  assert.ok(RULES.includes(".githooks/* text eol=lf"), "the git hook needs LF to run");
  for (const rule of RULES) {
    const [pattern, ...attrs] = rule.split(/\s+/);
    assert.ok(attrs.includes("eol=lf"), `${rule}: every line keeps LF`);
    // A wildcard the updater can't check is fine only for agent-ready's own files.
    const own = /^\.(agents|githooks)\//.test(pattern) || /(^|\/)(ar-|agent-ready)[^/]*$/.test(pattern);
    if (!own) assert.ok(!pattern.replace(/\/\*\*$/, "").includes("*"), `${pattern}: a document line must name a file, or a folder with /**`);
  }
});

test("a project without .gitattributes gets the whole block, and a second run adds nothing", () => {
  const p = project();
  try {
    const first = node(p.root, UPDATER, "--gitattributes");
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /Added agent-ready's block to \S*\.gitattributes: /);
    assert.doesNotMatch(first.out, /Left out/);
    assert.equal(attributes(p.root).replace(/\r\n/g, "\n"), TEMPLATE.replace(/\r\n/g, "\n"), "nothing was here, so every line is in");

    const text = attributes(p.root);
    const again = node(p.root, UPDATER, "--gitattributes");
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /already has agent-ready's block\. Nothing to change/);
    assert.equal(attributes(p.root), text, "the second run changes nothing");
    for (const rule of RULES) assert.equal(count(attributes(p.root), rule), 1, `${rule} once`);
  } finally {
    p.done();
  }
});

test("an existing .gitattributes keeps every line of yours, byte for byte, and the block goes after them", () => {
  const p = project();
  try {
    const yours = "# my settings\r\n*.png binary\r\n*.bat text eol=crlf\r\n.githooks/* text eol=lf\r\n";
    write(p.root, ".gitattributes", yours);
    write(p.root, "AGENTS.md", "My own agent notes.\r\n");
    write(p.root, "docs/build/site.html", "<p>my docs site</p>\n");

    const out = node(p.root, UPDATER, "--gitattributes");
    assert.equal(out.code, 0, out.out);
    const text = attributes(p.root);
    assert.ok(text.startsWith(`${yours}\r\n${START}\r\n`), "your lines first, untouched, then a blank line and the block");
    assert.doesNotMatch(text.replace(/\r\n/g, ""), /\n/, "the block uses the file's own line endings");
    assert.equal(count(text, ".githooks/* text eol=lf"), 1, "a pattern you already set is not repeated");
    assert.equal(count(text, "AGENTS.md text=auto eol=lf"), 0, "your AGENTS.md was here first, so it is left out");
    assert.equal(count(text, "docs/build/** text=auto eol=lf"), 0, "so is a folder you already had");
    assert.equal(count(text, "docs/rules/** text=auto eol=lf"), 1, "documents the setup is about to write are in");
    assert.equal(count(text, ".agents/scripts/** text=auto eol=lf"), 1, "agent-ready's own files are always in");
    assert.match(out.out, /Left out, because they are already here: AGENTS\.md, docs\/build\//);

    const again = node(p.root, UPDATER, "--gitattributes");
    assert.equal(again.code, 0, again.out);
    assert.equal(attributes(p.root), text, "a second run adds nothing");
    assert.equal(count(attributes(p.root), START), 1);
  } finally {
    p.done();
  }
});

test("a refresh replaces only the block: your lines around it, and lines the setup kept, stay", () => {
  const p = project();
  try {
    write(p.root, ".gitattributes", "*.png binary\n");
    node(p.root, UPDATER, "--gitattributes");
    write(p.root, "AGENTS.md", "written by the setup\n"); // listed at setup, and still listed now it exists
    const yoursAfter = "# added later, after the block\n*.sh text eol=lf\n";
    writeFileSync(path.join(p.root, ".gitattributes"), attributes(p.root) + yoursAfter);

    const newer = TEMPLATE.replace("docs/words.md text=auto eol=lf\n", "").replace(END, `.agents/new-tool/** text=auto eol=lf\n${END}`);
    const merged = mergeAttributes(attributes(p.root), newer, (pattern) => existsSync(path.join(p.root, pattern.replace(/\/\*\*$/, ""))));
    assert.equal(merged.action, "replace");
    assert.ok(merged.text.startsWith(`*.png binary\n\n${START}\n`), "your lines before the block stay");
    assert.ok(merged.text.endsWith(`${END}\n${yoursAfter}`), "your lines after the block stay");
    assert.equal(count(merged.text, ".agents/new-tool/** text=auto eol=lf"), 1, "a new line of agent-ready's arrives");
    assert.equal(count(merged.text, "docs/words.md text=auto eol=lf"), 0, "a retired line goes");
    assert.equal(count(merged.text, "AGENTS.md text=auto eol=lf"), 1, "a document line from the setup stays");
    assert.equal(mergeAttributes(merged.text, newer, () => true).action, "same", "refreshing again changes nothing");
  } finally {
    p.done();
  }
});

test("a block with no end line is refused, and the file is left as it is", () => {
  const p = project();
  try {
    const broken = `*.png binary\n${START}\n.agents/** text\n*.jpg binary\n`;
    write(p.root, ".gitattributes", broken);
    const out = node(p.root, UPDATER, "--gitattributes");
    assert.equal(out.code, 1);
    assert.match(out.out, /no "# agent-ready end" line/);
    assert.equal(attributes(p.root), broken);
  } finally {
    p.done();
  }
});

test("a project inside a set-up folder gets its own block, and the outer folder's .gitattributes is left alone", () => {
  const p = project();
  try {
    write(p.root, ".agents/hooks/guard.mjs", "// the outer project is set up\n");
    write(p.root, ".gitattributes", "*.png binary\n");
    const inner = path.join(p.root, "packages", "web");
    mkdirSync(inner, { recursive: true });
    const out = node(inner, UPDATER, "--gitattributes");
    assert.equal(out.code, 0, out.out);
    assert.ok(out.out.includes(path.join(inner, ".gitattributes")), "it names the file it wrote");
    assert.equal(attributes(p.root), "*.png binary\n", "the outer file is unchanged");
    assert.equal(attributes(inner).replace(/\r\n/g, "\n"), TEMPLATE.replace(/\r\n/g, "\n"), "the inner one gets the block, judged by its own files");
  } finally {
    p.done();
  }
});

// /ar-update in a project set up by 1.0.1 runs that version's updater, which
// doesn't know the block: there, it arrives through the "For your documents"
// list. This checks an updater that knows the block.
test("an updater that knows the block adds it when missing, without your documents' lines, and leaves your lines alone", () => {
  const p = project();
  try {
    const { root } = p;
    for (const name of ["guard.mjs", "precommit-guard.mjs"]) write(root, `.agents/hooks/${name}`, readFileSync(path.join(SKILL, "guards", name), "utf8"));
    write(root, ".agents/scripts/update.mjs", readFileSync(UPDATER, "utf8"));
    cpSync(path.join(SKILL, "commands"), path.join(root, ".agents", "commands"), { recursive: true });
    cpSync(SKILL, path.join(root, ".agents", "skills", "agent-ready"), { recursive: true });
    write(root, "AGENTS.md", "# AGENTS.md\n");
    write(root, "docs/rules/git.md", "# Git\n");
    const yours = "*.png binary\n.githooks/* text eol=lf\n"; // what an older setup left
    write(root, ".gitattributes", yours);
    assert.equal(node(root, ".agents/scripts/update.mjs", "--record").code, 0);

    const source = path.join(p.base, "source");
    cpSync(SKILL, path.join(source, "skills", "agent-ready"), { recursive: true });
    writeFileSync(path.join(source, "skills", "agent-ready", "VERSION"), "9.0.0\n");

    const dry = node(root, ".agents/scripts/update.mjs", "--from", source);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /add {6}\.gitattributes \(only agent-ready's block; your own lines stay as they are\)/);
    assert.equal(attributes(root), yours, "a dry run changes nothing");

    const out = node(root, ".agents/scripts/update.mjs", "--yes", "--from", source);
    assert.equal(out.code, 0, out.out);
    const text = attributes(root);
    assert.ok(text.startsWith(`${yours}\n${START}\n`), "your lines stay first, as they were");
    assert.equal(count(text, ".githooks/* text eol=lf"), 1);
    assert.equal(count(text, ".agents/hooks/** text=auto eol=lf"), 1, "agent-ready's own files are in");
    assert.equal(count(text, "AGENTS.md text=auto eol=lf") + count(text, "docs/rules/** text=auto eol=lf"), 0, "documents already here are left out");

    const again = node(root, ".agents/scripts/update.mjs", "--from", source);
    assert.match(again.out, /You're up to date: agent-ready 9\.0\.0/, "the block counts as up to date");
    assert.equal(attributes(root), text);
  } finally {
    p.done();
  }
});

test("with core.autocrlf=true, git warns about none of agent-ready's files, and your files keep their line endings", (t) => {
  if (git(os.tmpdir(), "--version").status !== 0) return t.skip("git is not installed");
  const p = project();
  try {
    const { root } = p;
    git(root, "init", "-q");
    git(root, "config", "core.autocrlf", "true");
    git(root, "config", "core.safecrlf", "warn"); // the default: so a global setting can't hide the warnings
    write(root, "src/app.js", "your code, with Windows line endings\r\n");
    assert.equal(node(root, UPDATER, "--gitattributes").code, 0);

    // What the setup writes, all with LF line endings, as on Windows.
    const setupFiles = [".agents/scripts/board.mjs", ".agents/skills/agent-ready/SKILL.md", ".agents/commands/ar-help.md", ".claude/commands/ar-help.md", ".githooks/pre-commit", "AGENTS.md", "CLAUDE.md", "docs/rules/git.md", "docs/build/README.md", "docs/operator/todo.md", "docs/stack.md", ".env.example", ".gitignore"];
    for (const file of setupFiles) write(root, file, `# ${file}\n# second line\n`);
    write(root, "src/new.js", "// code an agent wrote later, with LF\n");

    const added = git(root, "add", "-A");
    assert.equal(added.status, 0, added.stderr);
    assert.equal(git(root, "ls-files").stdout.trim().split("\n").length, setupFiles.length + 3, "every file is staged");
    // Git 2.37 and newer: "in the working copy of 'x', LF will be replaced by CRLF". Older: "LF will be replaced by CRLF in x."
    const warned = [...added.stderr.matchAll(/in the working copy of '([^']+)', LF will be replaced by CRLF|LF will be replaced by CRLF in (\S+)\./g)].map((m) => m[1] ?? m[2]).sort();
    assert.deepEqual(warned, [".gitattributes", "src/new.js"], "only files outside the block warn: none of the setup's documents or tools");

    const eol = Object.fromEntries(git(root, "ls-files", "--eol").stdout.trim().split("\n").map((line) => [line.split("\t").pop(), line]));
    assert.match(eol["src/app.js"], /^i\/lf\s+w\/crlf\s+attr\/\s/, "your file has no attribute and keeps its Windows line endings");
    assert.match(eol["AGENTS.md"], /i\/lf\s+w\/lf\s+attr\/text=auto eol=lf/, "saved with LF");
  } finally {
    p.done();
  }
});
