#!/usr/bin/env node
// agent-ready: switch the guard on in Codex.
//
// Codex runs a project's hooks only after the person reviews and trusts them.
// The Codex app shows a hook-approval icon in its bar for this, so most people
// approve it there. This is the fallback for when that icon is missing (an
// older version, or the editor extension): it opens a terminal window already
// running Codex in the project folder, and says what to press. It never trusts
// the hook itself: the person reviews it and decides.
//
//   node .agents/scripts/codex-guard.mjs           open the window and print the steps
//   node .agents/scripts/codex-guard.mjs --print   only print the steps

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK = "node .agents/hooks/guard.mjs";

export function steps(opened) {
  return [
    opened ? "A window with Codex running in this project has opened. In it:" : "Open a terminal in this project folder, type codex and press Enter. Then:",
    "  1. If Codex asks whether to trust this folder, choose yes.",
    "  2. Type /hooks and press Enter.",
    `  3. Pick the hook that runs "${HOOK}". Check that is the command, then choose Trust.`,
    "  4. Type /quit and press Enter.",
    "Then quit and reopen the Codex app, or start a new Codex session, so it loads the guard.",
    "If the hook's settings ever change, Codex skips it again until you trust it again: run this helper again.",
  ].join("\n");
}

function hasCodex() {
  return spawnSync("codex", ["--version"], { encoding: "utf8", shell: true }).status === 0;
}

// A new window, so the person sees Codex and can use it. Returns true if one opened.
function openWindow(root) {
  try {
    if (process.platform === "win32") {
      const where = `'${root.replace(/'/g, "''")}'`;
      const run = spawnSync("powershell.exe", ["-NoProfile", "-Command", `Start-Process -FilePath powershell.exe -WorkingDirectory ${where} -ArgumentList '-NoExit','-Command','codex'`], { encoding: "utf8" });
      return run.status === 0;
    }
    if (process.platform === "darwin") {
      // Quote the folder for the shell, then the whole line for AppleScript.
      const line = `cd '${root.replace(/'/g, "'\\''")}' && codex`.replace(/(["\\])/g, "\\$1");
      const run = spawnSync("osascript", ["-e", `tell application "Terminal" to do script "${line}"`, "-e", 'tell application "Terminal" to activate'], { encoding: "utf8" });
      return run.status === 0;
    }
  } catch {
    return false;
  }
  return false;
}

export function main(argv, { print = console.log, cwd = process.cwd() } = {}) {
  const root = path.resolve(cwd);
  if (!existsSync(path.join(root, ".codex", "config.toml"))) {
    print("This project has no .codex/config.toml, so there is no Codex hook to switch on. Run the agent-ready setup with Codex as one of the tools first.");
    return 1;
  }
  if (!hasCodex()) {
    print(
      [
        "Codex's command-line tool is not installed on this computer.",
        "The easier way: open this project in the Codex app, and approve the hook from the hook-approval icon in its bar.",
        "No icon there? Install the command-line tool once (in a terminal: npm install -g @openai/codex), then run this helper again.",
        "Until the hook is approved, Codex still follows the rules in AGENTS.md, but nothing hard-stops a mistake.",
      ].join("\n"),
    );
    return 1;
  }
  const opened = !argv.includes("--print") && openWindow(root);
  print(steps(opened));
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
