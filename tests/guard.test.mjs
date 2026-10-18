import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkToolCall, SELF_TEST_CASES } from "../skills/agent-ready/guards/guard.mjs";

const GUARD = fileURLToPath(new URL("../skills/agent-ready/guards/guard.mjs", import.meta.url));

function runHook(payload) {
  const result = spawnSync(process.execPath, [GUARD], { input: JSON.stringify(payload), encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

for (const [label, tool, input, expectBlocked] of SELF_TEST_CASES) {
  test(`checkToolCall: ${label}`, () => {
    assert.equal(checkToolCall(tool, input).blocked, expectBlocked);
  });
}

function denyOf(out) {
  return JSON.parse(out.stdout).hookSpecificOutput;
}

test("Claude Code payload: a blocked read answers deny in JSON with exit 0", () => {
  const out = runHook({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "C:\\repo\\.env" }, cwd: "C:\\repo" });
  assert.equal(out.code, 0);
  assert.equal(denyOf(out).hookEventName, "PreToolUse");
  assert.equal(denyOf(out).permissionDecision, "deny");
  assert.match(denyOf(out).permissionDecisionReason, /agent-ready guard/);
  assert.match(out.stderr, /agent-ready guard/);
});

test("Claude Code payload: normal read exits 0 with no output", () => {
  const out = runHook({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "/repo/src/index.ts" } });
  assert.equal(out.code, 0);
  assert.equal(out.stdout, "");
});

test("Codex payload: a shell read of .env answers deny", () => {
  const out = runHook({ hook_event_name: "PreToolUse", turn_id: "t1", tool_name: "Bash", tool_input: { command: "cat .env" } });
  assert.equal(out.code, 0);
  assert.equal(denyOf(out).permissionDecision, "deny");
});

test("Codex payload: an allowed command prints nothing", () => {
  const out = runHook({ hook_event_name: "PreToolUse", turn_id: "t1", tool_name: "Bash", tool_input: { command: "npm test" } });
  assert.equal(out.code, 0);
  assert.equal(out.stdout, "");
});

test("an unrecognised caller still gets exit 2 on a block", () => {
  const out = runHook({ tool_name: "Read", tool_input: { file_path: ".env" } });
  assert.equal(out.code, 2);
  assert.equal(out.stdout, "");
});

test("Cursor beforeReadFile: a blocked read denies in JSON with exit 0", () => {
  const out = runHook({
    conversation_id: "c1",
    hook_event_name: "beforeReadFile",
    file_path: "/repo/.env.local",
    content: "KEY=1",
    workspace_roots: ["/repo"],
  });
  assert.equal(out.code, 0);
  assert.equal(JSON.parse(out.stdout).permission, "deny");
});

test("Cursor beforeReadFile: file content that mentions .env does not matter", () => {
  const out = runHook({
    conversation_id: "c1",
    hook_event_name: "beforeReadFile",
    file_path: "/repo/README.md",
    content: "Copy .env.example to .env and run cat .env",
    workspace_roots: ["/repo"],
  });
  assert.equal(out.code, 0);
  assert.deepEqual(JSON.parse(out.stdout), { permission: "allow" });
});

test("Cursor beforeShellExecution: allowed command answers with allow JSON", () => {
  const out = runHook({ conversation_id: "c1", hook_event_name: "beforeShellExecution", command: "npm test", cwd: "/repo", workspace_roots: ["/repo"] });
  assert.equal(out.code, 0);
  assert.deepEqual(JSON.parse(out.stdout), { permission: "allow" });
});

test("Gemini BeforeTool payload: read_file of .env answers deny", () => {
  const out = runHook({ hook_event_name: "BeforeTool", tool_name: "read_file", tool_input: { file_path: ".env" }, session_id: "s" });
  assert.equal(out.code, 0);
  assert.equal(JSON.parse(out.stdout).decision, "deny");
});

test("a block survives a tool that runs the hook through PowerShell", { skip: process.platform !== "win32" }, () => {
  const payload = JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: ".env" } });
  const result = spawnSync("pwsh", ["-NoProfile", "-Command", `node "${GUARD}"`], { input: payload, encoding: "utf8" });
  if (result.error) return; // PowerShell 7 not installed
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");
});

test("unreadable input is let through with a warning, not a crash", () => {
  const result = spawnSync(process.execPath, [GUARD], { input: "not json", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /could not read the hook input/);
});

test("self-test mode passes", () => {
  const result = spawnSync(process.execPath, [GUARD, "--self-test"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout);
});

test("the OpenCode plugin throws on a blocked call and stays quiet otherwise", async () => {
  const pluginPath = path.join(path.dirname(GUARD), "..", "tool-configs", "opencode-plugin.js");
  const source = (await import("node:fs")).readFileSync(pluginPath, "utf8");
  assert.match(source, /from "\.\.\/\.\.\/\.agents\/hooks\/guard\.mjs"/);

  // Load the plugin against this repo's guard by rewriting the import path.
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(path.join(tmpdir(), "agent-ready-opencode-"));
  const rewired = source.replace("../../.agents/hooks/guard.mjs", new URL(`file:///${GUARD.replace(/\\/g, "/")}`).href);
  const file = path.join(dir, "plugin.mjs");
  writeFileSync(file, rewired);
  const { AgentReadyGuard } = await import(new URL(`file:///${file.replace(/\\/g, "/")}`).href);
  const hooks = await AgentReadyGuard({});

  await assert.rejects(hooks["tool.execute.before"]({ tool: "read" }, { args: { filePath: "/app/.env" } }), /agent-ready guard/);
  await hooks["tool.execute.before"]({ tool: "bash" }, { args: { command: "npm test" } });
});
