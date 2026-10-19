---
description: Take the next ready item and see it through - claim, build, check, review, save.
argument-hint: "[item ID]"
---
Take the next ready item and see it through, as the loop in `docs/rules/workflow.md` says. In parallel mode, use `/ar-coordinate` instead.

1. Run `node .agents/scripts/board.mjs ready`. It lists **paused** work first: items someone stopped partway. Pick that up before anything new: read its handoff, then run `node .agents/scripts/board.mjs resume <id> --agent <your name>`, and carry on from its partial work. Nothing ready or paused? Say why (the board's Waiting list) and what would unblock it, then stop.
2. Otherwise claim the first ready one, or the one the operator named ($ARGUMENTS), with `node .agents/scripts/board.mjs claim <id> --agent <your name>`. If the board says someone else holds it, leave it.
3. Build it, check it (`docs/rules/testing.md`), review it ("Item review" in `docs/rules/review.md`), finish it against the definition of done, and make its save point (`docs/rules/git.md`). Then release the claim.
4. Stopping before it is done? Write a handoff (`/ar-handoff`), release the claim and leave the item `[~]`, so the next session can resume it.
5. Tell the operator in plain words what now works, how to try it, and anything they need to do. Suggest a fresh session for the next item.
