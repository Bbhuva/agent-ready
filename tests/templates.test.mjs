import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = fileURLToPath(new URL("../skills/agent-ready/", import.meta.url));
const templates = path.join(skillDir, "templates");
const read = (file) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

// Project paths like `docs/rules/workflow.md`, in backticks or as a link
// target. Paths with a placeholder in them (<name>, {{...}}, *) are examples,
// not real files.
function docRefs(text) {
  return [...text.matchAll(/(?:`|\]\()(docs\/[^`\s)]+\.md)(?:`|\))/g)].map((match) => match[1]).filter((ref) => !/[<{*]/.test(ref));
}

test("the AGENTS.md template stays a short map", () => {
  const lines = read(path.join(templates, "AGENTS.md")).trimEnd().split("\n").length;
  assert.ok(lines <= 80, `templates/AGENTS.md has ${lines} lines. Move detail into templates/docs/rules/.`);
});

test("CLAUDE.md and GEMINI.md only point at AGENTS.md", () => {
  for (const name of ["CLAUDE.md", "GEMINI.md"]) {
    const text = read(path.join(templates, name));
    assert.match(text, /^@AGENTS\.md$/m, `${name} must import AGENTS.md`);
    assert.ok(text.trimEnd().split("\n").length <= 8, `${name} must stay a pointer`);
  }
});

test("every doc the templates and SKILL.md mention is shipped in templates/", () => {
  // SKILL.md names the old layout's files when it explains how to migrate, so
  // that last section is left out.
  const skill = read(path.join(skillDir, "SKILL.md")).split("## Running this skill again")[0];
  const sources = [
    ...walk(templates)
      .filter((file) => file.endsWith(".md"))
      .map((file) => [path.relative(skillDir, file), read(file)]),
    ["SKILL.md", skill],
  ];
  const generated = new Set(["docs/build/graph.md", "docs/operator/commands.md"]); // made by board.mjs and commands.mjs in the project
  const missing = sources.flatMap(([name, text]) =>
    docRefs(text)
      .filter((ref) => !generated.has(ref) && !existsSync(path.join(templates, ref)))
      .map((ref) => `${name} mentions ${ref}`),
  );
  assert.deepEqual(missing, []);
});

test("every skill file SKILL.md mentions exists", () => {
  const refs = [...read(path.join(skillDir, "SKILL.md")).matchAll(/`((?:templates|guards|scripts|commands|tool-configs|reference)\/[^`\s]*)`/g)].map((m) => m[1]);
  assert.ok(refs.length > 10, "expected SKILL.md to name its template files");
  assert.deepEqual(refs.filter((ref) => !existsSync(path.join(skillDir, ref))), []);
});

test("every doc in the rules table of AGENTS.md exists", () => {
  const agents = read(path.join(templates, "AGENTS.md"));
  const table = agents.slice(agents.indexOf("## Load only when you need it"), agents.indexOf("## Commands"));
  const refs = docRefs(table);
  assert.ok(refs.includes("docs/rules/workflow.md") && refs.includes("docs/rules/review.md"));
  assert.deepEqual(refs.filter((ref) => !existsSync(path.join(templates, ref))), []);
});

test("the operator's files live in docs/operator, and nothing but documents ships in docs/", () => {
  assert.ok(!existsSync(path.join(templates, "MTEST.md")), "MTEST.md belongs in docs/operator/mtest.md");
  for (const name of ["todo.md", "mtest.md", "guide.md"]) assert.ok(existsSync(path.join(templates, "docs", "operator", name)), `docs/operator/${name} is missing`);
  const notDocs = walk(path.join(templates, "docs")).filter((file) => !file.endsWith(".md"));
  assert.deepEqual(notDocs, []);
});

test("the health check expects exactly the docs the templates ship", async () => {
  const source = read(path.join(skillDir, "scripts", "health.mjs"));
  const expected = [...source.matchAll(/"(docs\/[^"]+\.md)"/g)].map((m) => m[1]);
  const rules = source.match(/const RULES = \[([^\]]+)\]/)[1].match(/"([a-z]+)"/g).map((name) => `docs/rules/${name.replace(/"/g, "")}.md`);
  assert.ok(expected.length > 5 && rules.length > 5);
  assert.deepEqual([...expected, ...rules].filter((doc) => !existsSync(path.join(templates, doc))), []);
});

test("the board settings template is valid and complete", () => {
  const config = JSON.parse(read(path.join(skillDir, "tool-configs", "board.json")));
  assert.equal(config.mainBranch, "main");
  assert.ok(Array.isArray(config.checks));
  assert.ok(config.maxBuilders > 0);
});

test("a project made from the templates passes the board check", () => {
  const out = spawnSync(process.execPath, [path.join(skillDir, "scripts", "board.mjs"), "check", "--root", templates], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
});

test("SKILL.md front matter suits skill installers", () => {
  const front = read(path.join(skillDir, "SKILL.md")).match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(front, /^name: agent-ready$/m);
  const description = front.match(/^description: (.+)$/m)[1];
  assert.ok(description.length <= 1024, `description is ${description.length} characters; the limit is 1024`);
  assert.doesNotMatch(description, /[<>]/);
});

test("the paste-in prompt stays short and downloads the skill", () => {
  const prompt = read(path.join(skillDir, "..", "..", "PROMPT.md"));
  const box = prompt.match(/```text\n([\s\S]*?)```/)[1];
  assert.ok(box.split("\n").length <= 12, "the box someone pastes stays under a dozen lines");
  assert.match(box, /git clone --depth 1 https:\/\/github\.com\/Bbhuva\/agent-ready \.agent-ready-download/);
  assert.match(box, /archive\/refs\/heads\/main\.zip/);
  assert.match(box, /skills\/agent-ready\/SKILL\.md/);
  assert.match(box, /permission/i);
});

test("every command is named ar-, has a description, and points only at real docs", () => {
  const dir = path.join(skillDir, "commands");
  const files = readdirSync(dir).filter((file) => file.endsWith(".md"));
  assert.ok(files.length >= 15);
  assert.ok(files.includes("ar-help.md"));
  const generated = new Set(["docs/operator/commands.md", "docs/build/graph.md"]);
  for (const file of files) {
    const text = read(path.join(dir, file));
    assert.match(file, /^ar-[a-z]+\.md$/);
    assert.match(text, /^---\ndescription: .{10,}\n/, `${file} needs a description`);
    const missing = docRefs(text).filter((ref) => !generated.has(ref) && !existsSync(path.join(templates, ref)));
    assert.deepEqual(missing, [], `${file} points at docs that don't exist`);
    for (const script of text.match(/\.agents\/scripts\/[a-z]+\.mjs/g) ?? []) assert.ok(existsSync(path.join(skillDir, "scripts", path.basename(script))), `${file}: ${script}`);
  }
});
