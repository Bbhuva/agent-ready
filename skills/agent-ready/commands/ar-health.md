---
description: Check the setup is still sound, and fix or explain anything that is not.
---
Run `node .agents/scripts/health.mjs` and explain the result in plain words.

Fix every FIX line you can fix yourself (ask first if it changes the operator's settings). For each LOOK line, say what it means, then either fix it, ask the operator to do it now if it takes a minute (a restart, or approving the guard from the hook-approval icon in the Codex app's bar, with `node .agents/scripts/codex-guard.mjs` as the fallback), or, if it is work for later that only they can do, add an entry to `docs/operator/todo.md`. Finish with the Health line from the end of the report.
