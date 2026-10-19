---
description: Go back to before a finished item, without losing anything.
argument-hint: "[item ID]"
---
The operator wants to go back: $ARGUMENTS

As "Save points" in `docs/rules/git.md` says:

1. Not sure which item they mean? Show the last few save points (`git log --oneline --first-parent`) in plain words and ask.
2. Run `node .agents/scripts/board.mjs undo <id>`. It lists the item's save points that are not undone yet, and marks a merge as one step that also covers the builder's commits inside it. Tell the operator in plain words what will be undone, and wait for a yes.
3. Run `node .agents/scripts/board.mjs undo <id> --yes`. It reverses each save point once, newest first, reopens the item and runs the checks. Never reset or rewrite history, and never revert the commits yourself on top of this: that would undo the same work twice.
4. If it refuses because of unsaved changes, or stops because a later save point changed the same lines, say so plainly and ask how to go on. If the operator doesn't want the item built again, mark it `[-]` with the reason. Tell them what changed. Nothing is lost: if they change their mind, run the `git revert` command the undo printed, which brings the item back as it was.
