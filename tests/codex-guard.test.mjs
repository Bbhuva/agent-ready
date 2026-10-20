import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { main, steps } from "../skills/agent-ready/scripts/codex-guard.mjs";

function run(cwd, ...args) {
  const lines = [];
  const code = main(args, { cwd, print: (text) => lines.push(text) });
  return { code, out: lines.join("\n") };
}

test("the steps say exactly what to press, and never trust the hook for the person", () => {
  for (const opened of [true, false]) {
    const text = steps(opened);
    assert.match(text, /\/hooks/);
    assert.match(text, /node \.agents\/hooks\/guard\.mjs/, "names the command to check before trusting it");
    assert.match(text, /choose Trust/);
    assert.match(text, /\/quit/);
    assert.match(text, /reopen the Codex app/);
  }
  assert.match(steps(true), /has opened/);
  assert.match(steps(false), /type codex and press Enter/);
});

test("without Codex set up in the project, it says so and changes nothing", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agent-ready-codex-"));
  try {
    const out = run(dir, "--print");
    assert.equal(out.code, 1);
    assert.match(out.out, /no \.codex\/config\.toml/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--print gives the steps, or how to install Codex's command-line tool, without opening anything", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agent-ready-codex-"));
  try {
    mkdirSync(path.join(dir, ".codex"));
    writeFileSync(path.join(dir, ".codex", "config.toml"), "");
    const out = run(dir, "--print");
    if (out.code === 0) assert.match(out.out, /^Open a terminal in this project folder/, "with --print it never opens a window");
    else assert.match(out.out, /npm install -g @openai\/codex/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
