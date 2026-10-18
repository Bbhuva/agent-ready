---
description: Show what the agents need from you, or mark one of your to-dos done.
argument-hint: "[op-ID done]"
---
Help the operator with their to-do list, `docs/operator/todo.md`.

What they typed: $ARGUMENTS

- If they named an `op-` ID as done: check it worked if you can (for a key, `node .agents/scripts/keys.mjs` shows the name as set), tick it with `**Done:** <date>`, move it to Done, and say what it unblocked (`node .agents/scripts/board.mjs`).
- Otherwise: list what is waiting on them, most urgent first, with the ID, the title and the first step, in plain words. Offer to walk them through one.

Never ask them to paste a key or password into the chat.
