// agent-ready guard for OpenCode.
// Copy to .opencode/plugins/agent-ready-guard.js. OpenCode loads it at startup.
// Same rules as the other tools: the logic lives in .agents/hooks/guard.mjs.

import { checkToolCall } from "../../.agents/hooks/guard.mjs";

export const AgentReadyGuard = async () => ({
  "tool.execute.before": async (input, output) => {
    const verdict = checkToolCall(input.tool, output.args ?? {});
    if (verdict.blocked) throw new Error(verdict.message);
  },
});
