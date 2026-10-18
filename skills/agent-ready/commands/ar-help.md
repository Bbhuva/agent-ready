---
description: List every agent-ready command, and suggest the ones that fit right now.
---
Show the operator every agent-ready command.

1. Run `node .agents/scripts/commands.mjs` and show the list it prints: each command and one line on what it does.
2. Run `node .agents/scripts/board.mjs` and suggest the two or three commands that fit right now. For example `/ar-todo` if things are waiting on them, `/ar-next` if an item is ready, `/ar-review phase` if a phase just finished.
3. Remind them the full list is always in `docs/operator/commands.md`, and that in a tool without these commands they can type the name without the slash, like "ar-status".
