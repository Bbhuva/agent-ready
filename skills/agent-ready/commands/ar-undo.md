---
description: Go back to before a finished item, without losing anything.
argument-hint: "[item ID]"
---
The operator wants to go back: $ARGUMENTS

As "Save points" in `docs/rules/git.md` says:

1. Find the save points for that item with `git log --oneline` (their messages name the item ID). Not sure which one they mean? Show the last few save points in plain words and ask.
2. Tell them what will be undone, in plain words, and wait for a yes.
3. Run `git revert <commit>` for each one, newest first. Never reset or rewrite history.
4. Reopen the item in its plan if it should be built again, run the checks, and tell them what changed. Nothing is lost: the undo can be undone too.
