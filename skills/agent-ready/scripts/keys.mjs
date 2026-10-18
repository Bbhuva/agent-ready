#!/usr/bin/env node
// agent-ready keys
//
// Lets the operator put secret keys into .env without pasting them into a chat,
// and lets agents check which keys are set without ever seeing a value.
// No dependencies. Node 18 or newer.
//
//   node .agents/scripts/keys.mjs              which names from .env.example are set (never the values)
//   node .agents/scripts/keys.mjs check        the same; exit code 1 if a required key is missing
//   node .agents/scripts/keys.mjs add <NAME>   for the operator, in their own terminal: asks for the
//                                              value without showing it, then saves it to .env
//
// A name in .env.example counts as optional when its line ends with "# optional".
// The key file is .env.local if it exists, otherwise .env. The operator can pass
// --file <name> to choose another one.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function findRoot(start = process.cwd()) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, ".env.example")) || existsSync(path.join(dir, "AGENTS.md")) || existsSync(path.join(dir, ".git"))) return dir;
    if (path.dirname(dir) === dir) return path.resolve(start);
  }
}

export function keyFile(root, chosen) {
  if (chosen) return path.resolve(root, chosen);
  const local = path.join(root, ".env.local");
  return existsSync(local) ? local : path.join(root, ".env");
}

// Names (and whether each one is optional) from .env.example.
export function expectedKeys(root) {
  const file = path.join(root, ".env.example");
  if (!existsSync(file)) return [];
  const keys = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match) keys.push({ name: match[1], optional: /#\s*optional\b/i.test(match[2]) });
  }
  return keys;
}

// Which names have a non-empty value. The values themselves never leave this function.
function filledNames(file) {
  const filled = new Set();
  if (!existsSync(file)) return filled;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].replace(/\s+#.*$/, "").trim().replace(/^(['"])(.*)\1$/, "$2");
    if (value) filled.add(match[1]);
  }
  return filled;
}

export function keyStatus(root, chosen) {
  const file = keyFile(root, chosen);
  const expected = expectedKeys(root);
  const filled = filledNames(file);
  const listed = new Set(expected.map((key) => key.name));
  return {
    file: path.relative(root, file) || path.basename(file),
    fileExists: existsSync(file),
    set: expected.filter((key) => filled.has(key.name)).map((key) => key.name),
    missing: expected.filter((key) => !filled.has(key.name) && !key.optional).map((key) => key.name),
    optionalMissing: expected.filter((key) => !filled.has(key.name) && key.optional).map((key) => key.name),
    unlisted: [...filled].filter((name) => !listed.has(name)),
  };
}

function report(status) {
  const lines = [];
  if (!status.fileExists) lines.push(`There is no ${status.file} yet.`);
  for (const name of status.set) lines.push(`  set      ${name}`);
  for (const name of status.missing) lines.push(`  MISSING  ${name}`);
  for (const name of status.optionalMissing) lines.push(`  empty    ${name} (optional)`);
  if (status.unlisted.length) lines.push(`Set in ${status.file} but not listed in .env.example: ${status.unlisted.join(", ")}. Add the names (never the values) to .env.example.`);
  if (status.missing.length) {
    lines.push("", "To add one, the operator runs this in their own terminal and pastes the key when asked:");
    for (const name of status.missing) lines.push(`  node .agents/scripts/keys.mjs add ${name}`);
  } else if (status.set.length || status.optionalMissing.length) {
    lines.push("", "Every required key is set.");
  } else {
    lines.push(".env.example lists no keys yet.");
  }
  return lines.join("\n");
}

// Write NAME=value into the key file: replace the line if the name is there,
// otherwise add it at the end.
export function saveKey(file, name, value) {
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const safe = /[\s#'"\\]/.test(value) ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : value;
  const lines = text ? text.split(/\r?\n/) : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const at = lines.findIndex((line) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line));
  if (at === -1) lines.push(`${name}=${safe}`);
  else lines[at] = `${name}=${safe}`;
  writeFileSync(file, lines.join(eol) + eol);
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          input.setRawMode(false);
          process.stdout.write("\n");
          return reject(new Error("Cancelled. Nothing was saved."));
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        value += ch;
        process.stdout.write("*");
      }
    };
    input.on("data", onData);
  });
}

function gitIgnores(root, file) {
  const git = spawnSync("git", ["check-ignore", "-q", file], { cwd: root });
  if (git.status === 0) return true;
  if (git.status === 1) return false;
  const ignore = path.join(root, ".gitignore"); // not a git repo: read the file itself
  if (!existsSync(ignore)) return false;
  const name = path.basename(file);
  return readFileSync(ignore, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === name || line === `/${name}` || line === ".env*" || (line === ".env.*" && name !== ".env"));
}

async function add(root, name, chosen) {
  if (!name || !NAME.test(name)) {
    console.error("Say which key: add <NAME>, using the name from .env.example (letters, digits and _).");
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error("Run this yourself, in your own terminal window, so you can type the key without anyone seeing it. AI agents must not run it.");
    return 1;
  }
  const file = keyFile(root, chosen);
  if (!gitIgnores(root, file)) {
    console.error(`${path.basename(file)} is not in .gitignore, so the key could end up in git. Ask an agent to add it to .gitignore first.`);
    return 1;
  }
  if (!expectedKeys(root).some((key) => key.name === name)) console.log(`Note: ${name} is not in .env.example yet. Ask an agent to add the name there.`);
  let value;
  try {
    value = (await askHidden(`Paste the value for ${name} (it will show as stars), then press Enter: `)).trim();
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (!value) {
    console.error("Nothing was typed, so nothing was saved.");
    return 1;
  }
  saveKey(file, name, value);
  console.log(`Saved ${name} in ${path.basename(file)}. Tell your agent "${name} is set". It can check with: node .agents/scripts/keys.mjs`);
  return 0;
}

export async function main(argv = process.argv) {
  const args = argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const positional = args.filter((arg, i) => !arg.startsWith("--") && !["--file", "--root"].includes(args[i - 1]));
  const [command = "check", name] = positional;
  const root = valueOf("--root") ? path.resolve(valueOf("--root")) : findRoot();
  if (command === "add") return add(root, name, valueOf("--file"));
  if (command === "check") {
    const status = keyStatus(root, valueOf("--file"));
    console.log(report(status));
    return status.missing.length ? 1 : 0;
  }
  console.error(`Unknown command "${command}". Use: check, or add <NAME>.`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
