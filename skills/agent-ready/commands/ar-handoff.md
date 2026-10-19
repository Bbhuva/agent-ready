---
description: Write a handoff note so the next session can carry on without this chat.
argument-hint: "[topic]"
---
Write a handoff so the next session can pick up without this chat. Topic, if they gave one: $ARGUMENTS

Copy `docs/build/templates/handoff.md` to `docs/build/handoffs/<date>-<topic>.md` and fill it in: where things stand, what changed, what was and wasn't checked, the item IDs involved, open decisions, the next steps in order, and what only the operator can do.

If an item is unfinished, leave it marked `[~]` and release its claim (`node .agents/scripts/board.mjs release <id>`), so it shows as paused and the next session can pick it up with `resume`.

Then tell the operator the file name, and that a fresh session can start with: "Read AGENTS.md, then <that file>, and carry on" (or `/ar-next`, which resumes paused work first).
