#!/usr/bin/env node
// agent-ready commands
//
// The operator's slash commands (/ar-help, /ar-status and the rest) are written
// once, in .agents/commands/<name>.md. This script lists them, and writes them
// into each agent tool's own command folder in that tool's format.
// No dependencies. Node 18 or newer.
//
//   node .agents/scripts/commands.mjs                  list every command
//   node .agents/scripts/commands.mjs install          write them for every tool set up in this project
//   node .agents/scripts/commands.mjs install --tools claude,cursor,gemini,opencode
//   node .agents/scripts/commands.mjs install --codex  also add them to Codex, which keeps commands in
//                                                      your home folder (~/.codex/prompts), not the project
//
// Files this script writes carry the line "made by agent-ready". It never
// overwrites a file without that line, so your own commands are safe.

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MARK = "made by agent-ready";

// The order the list shows them in: help first, then the everyday loop.
const ORDER = ["ar-help", "ar-status", "ar-next", "ar-todo", "ar-keys", "ar-shape", "ar-plan", "ar-review", "ar-bug", "ar-undo", "ar-deploy", "ar-handoff", "ar-explain", "ar-rule", "ar-health", "ar-launch", "ar-coordinate", "ar-setup"];

const note = (name) => `${MARK}: edit .agents/commands/${name}.md, then run node .agents/scripts/commands.mjs install`;
const yamlString = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const tomlString = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const tomlBlock = (text) => String(text).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');

export const TOOLS = {
  claude: {
    label: "Claude Code",
    detect: [".claude", "CLAUDE.md"],
    dir: ".claude/commands",
    file: (name) => `${name}.md`,
    typed: (name) => `/${name}`,
    render: (c) =>
      `---\ndescription: ${yamlString(c.description)}\n${c.argumentHint ? `argument-hint: ${yamlString(c.argumentHint)}\n` : ""}disable-model-invocation: true\n---\n<!-- ${note(c.name)} -->\n\n${c.body}\n`,
  },
  cursor: {
    label: "Cursor",
    detect: [".cursor"],
    dir: ".cursor/commands",
    file: (name) => `${name}.md`,
    typed: (name) => `/${name}`,
    render: (c) => `<!-- ${note(c.name)} -->\n# /${c.name}\n\n${c.description}\n\n${c.body.replace(/\$ARGUMENTS/g, "(whatever the operator typed after the command)")}\n`,
  },
  gemini: {
    label: "Gemini CLI",
    detect: [".gemini", "GEMINI.md"],
    dir: ".gemini/commands",
    file: (name) => `${name}.toml`,
    typed: (name) => `/${name}`,
    render: (c) => `# ${note(c.name)}\ndescription = ${tomlString(c.description)}\nprompt = """\n${tomlBlock(c.body.replace(/\$ARGUMENTS/g, "{{args}}"))}\n"""\n`,
  },
  opencode: {
    label: "OpenCode",
    detect: [".opencode", "opencode.json", "opencode.jsonc"],
    dir: ".opencode/commands",
    file: (name) => `${name}.md`,
    typed: (name) => `/${name}`,
    render: (c) => `---\ndescription: ${yamlString(c.description)}\n---\n<!-- ${note(c.name)} -->\n\n${c.body}\n`,
  },
};

export const CODEX = {
  label: "Codex",
  dir: () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "prompts"),
  file: (name) => `${name}.md`,
  typed: (name) => `/prompts:${name}`,
  render: (c) =>
    `---\ndescription: ${yamlString(c.description)}\n${c.argumentHint ? `argument-hint: ${yamlString(c.argumentHint)}\n` : ""}---\n<!-- ${note(c.name)} -->\n\n${c.body}\n`,
};

export function findRoot(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, ".agents", "commands"))) return dir;
    if (path.dirname(dir) === dir) return path.resolve(start);
  }
}

function parse(name, text) {
  const match = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const field = line.match(/^([a-z-]+):\s*(.*)$/);
    if (field) meta[field[1]] = field[2].trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
  }
  return { name, description: meta.description ?? "", argumentHint: meta["argument-hint"] ?? "", body: (match?.[2] ?? text).trim() };
}

export function loadCommands(root) {
  const dir = path.join(root, ".agents", "commands");
  if (!existsSync(dir)) return [];
  const commands = readdirSync(dir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => parse(file.slice(0, -3), readFileSync(path.join(dir, file), "utf8")));
  const rank = (name) => (ORDER.includes(name) ? ORDER.indexOf(name) : ORDER.length);
  return commands.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export function detectTools(root) {
  return Object.keys(TOOLS).filter((key) => TOOLS[key].detect.some((marker) => existsSync(path.join(root, marker))));
}

// Write each command for one tool. Returns what was written, kept and removed.
function installFor(dir, tool, commands) {
  mkdirSync(dir, { recursive: true });
  const result = { written: 0, kept: [], removed: 0 };
  const wanted = new Set(commands.map((c) => tool.file(c.name)));
  for (const c of commands) {
    const file = path.join(dir, tool.file(c.name));
    if (existsSync(file) && !readFileSync(file, "utf8").includes(MARK)) {
      result.kept.push(path.basename(file));
      continue;
    }
    writeFileSync(file, tool.render(c));
    result.written++;
  }
  for (const file of readdirSync(dir)) {
    if (!file.startsWith("ar-") || wanted.has(file)) continue;
    const full = path.join(dir, file);
    if (readFileSync(full, "utf8").includes(MARK)) {
      unlinkSync(full); // a command that no longer exists
      result.removed++;
    }
  }
  return result;
}

export function renderList(commands, { installedFor = [], codex = false } = {}) {
  const width = Math.max(...commands.map((c) => c.name.length + (c.argumentHint ? c.argumentHint.length + 1 : 0)), 10) + 3;
  const lines = ["agent-ready commands. Type one in your agent's chat:", ""];
  for (const c of commands) lines.push(`  ${`/${c.name}${c.argumentHint ? ` ${c.argumentHint}` : ""}`.padEnd(width)}${c.description}`);
  lines.push("");
  if (installedFor.length) lines.push(`Installed for: ${installedFor.join(", ")}.`);
  if (codex) lines.push("In Codex, type /prompts: first, like /prompts:ar-help.");
  lines.push('In a tool without these commands, type the name without the slash, like "ar-status". The agent looks it up in .agents/commands/.');
  return lines.join("\n");
}

function renderDoc(commands, installedFor, codex) {
  const rows = commands.map((c) => `| \`/${c.name}${c.argumentHint ? ` ${c.argumentHint}` : ""}\` | ${c.description.replace(/\|/g, "\\|")} |`);
  return `<!-- ${MARK}: this list is made by node .agents/scripts/commands.mjs install. Edit .agents/commands/ instead. -->
# Your commands

Type any of these in your agent's chat. Forgot one? Type \`/ar-help\`, or come back to this page.

| Command | What it does |
| --- | --- |
${rows.join("\n")}

- **Where they work:** ${installedFor.length ? installedFor.join(", ") : "no tool yet; run \`node .agents/scripts/commands.mjs install\`"}.${codex ? " In Codex, type `/prompts:` first, like `/prompts:ar-help`." : ""}
- **In any other tool,** type the name without the slash, like "ar-status". The agent finds it in \`.agents/commands/\`.
- Words in square brackets are optional extras, like \`/ar-undo auth-003\` or \`/ar-todo op-002 done\`.
`;
}

export function install(root, { tools, codex = false } = {}) {
  const commands = loadCommands(root);
  if (!commands.length) return { ok: false, message: "There are no commands in .agents/commands/ yet. The agent-ready setup copies them there." };
  const chosen = tools?.length ? tools : detectTools(root);
  const unknown = chosen.filter((key) => !TOOLS[key]);
  if (unknown.length) return { ok: false, message: `Unknown tool: ${unknown.join(", ")}. Use: ${Object.keys(TOOLS).join(", ")}.` };
  const lines = [];
  const installedFor = [];
  for (const key of chosen) {
    const tool = TOOLS[key];
    const result = installFor(path.join(root, tool.dir), tool, commands);
    installedFor.push(tool.label);
    lines.push(`${tool.label}: ${result.written} commands in ${tool.dir}${result.removed ? `, ${result.removed} old ones removed` : ""}.`);
    if (result.kept.length) lines.push(`  Kept your own files: ${result.kept.join(", ")}.`);
  }
  if (codex) {
    const dir = CODEX.dir();
    const result = installFor(dir, CODEX, commands);
    installedFor.push("Codex");
    lines.push(`Codex: ${result.written} commands in ${dir} (type /prompts:ar-help).`);
  }
  const doc = path.join(root, "docs", "operator", "commands.md");
  if (existsSync(path.dirname(doc))) {
    writeFileSync(doc, renderDoc(commands, installedFor, codex));
    lines.push("Wrote docs/operator/commands.md, the list for the operator.");
  }
  if (!chosen.length && !codex) lines.push("No agent tool is set up in this folder yet. Name one with --tools claude,cursor,gemini,opencode.");
  return { ok: true, message: lines.join("\n") };
}

export function main(argv = process.argv) {
  const args = argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const root = valueOf("--root") ? path.resolve(valueOf("--root")) : findRoot();
  const command = args.find((arg, i) => !arg.startsWith("--") && !["--root", "--tools"].includes(args[i - 1])) ?? "list";
  if (command === "list") {
    const commands = loadCommands(root);
    if (!commands.length) {
      console.error("There are no commands in .agents/commands/ yet. The agent-ready setup copies them there.");
      return 1;
    }
    const installedFor = Object.values(TOOLS).filter((tool) => existsSync(path.join(root, tool.dir, tool.file("ar-help")))).map((tool) => tool.label);
    const codex = existsSync(path.join(CODEX.dir(), CODEX.file("ar-help")));
    console.log(renderList(commands, { installedFor: codex ? [...installedFor, "Codex"] : installedFor, codex }));
    return 0;
  }
  if (command === "install") {
    const tools = valueOf("--tools")?.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const result = install(root, { tools, codex: args.includes("--codex") });
    (result.ok ? console.log : console.error)(result.message);
    return result.ok ? 0 : 1;
  }
  console.error(`Unknown command "${command}". Use: list, or install.`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
