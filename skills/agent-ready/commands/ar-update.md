---
description: Get the newest agent-ready, without touching your documents or plans.
---
Update this project to the newest agent-ready.

1. Run `node .agents/scripts/update.mjs`. It downloads the newest version and shows what would change, without changing anything. (No internet, or no git? Follow what it prints.)
2. Tell the operator in plain words: the version they have and the new one, what's new, which of agent-ready's own files will be replaced, and any they changed themselves, which are kept. If it says there is no record of the version, ask whether they changed any of those files on purpose. Wait for their yes.
3. Run `node .agents/scripts/update.mjs --yes`. Check that the self-tests it runs pass.
4. Go through each "For your documents" list it printed, one item at a time: read the matching file in this project, and propose the exact change, merged into what is there now. Never replace a document wholesale, and never touch the operator overrides in `AGENTS.md`, plans, decisions or to-dos, except to add what the list says. Apply each change only after their yes.
5. Run `node .agents/scripts/health.mjs` and fix what it asks, as `/ar-health` says.
6. If a tool's hook settings changed, the operator may need to approve the guard again (in Codex, from the hook-approval icon in the app's bar). Say so if the update says it changed.
7. Make a save point: stage only the files the update and your edits changed, and commit as `chore: update agent-ready to <version>`.
