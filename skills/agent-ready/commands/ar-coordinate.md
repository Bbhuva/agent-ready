---
description: Run several agents at once - start builders on separate items and merge their work in order.
argument-hint: "[notes]"
---
Coordinate several agents at once, as `docs/rules/parallel.md` says. You are the coordinator: work in the main checkout, and don't build items yourself while builders run. Extra instructions: $ARGUMENTS

1. Run `node .agents/scripts/board.mjs check`, then `node .agents/scripts/board.mjs next`.
2. For each item it lists, run `node .agents/scripts/board.mjs start <id> --agent <builder name>`. Then tell the operator, in plain words, to open a new session in the worktree it printed and paste the brief it printed (or start the builder yourself, if this tool can run other agents).
3. When a builder says its item is ready: run the item review on its branch, list the finished items to the operator, and when they say "merge", run `node .agents/scripts/board.mjs merge <id>` for each, in the order the board allows. Copy each report's notes into the shared files.
4. Repeat until the phase's Must items are done, then suggest `/ar-review phase`.
