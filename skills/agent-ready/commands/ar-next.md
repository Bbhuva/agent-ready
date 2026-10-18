---
description: Take the next ready item and see it through - claim, build, check, review, save.
argument-hint: "[item ID]"
---
Take the next ready item and see it through, as the loop in `docs/rules/workflow.md` says. In parallel mode, use `/ar-coordinate` instead.

1. Run `node .agents/scripts/board.mjs ready`. Nothing ready? Say why (the board's Waiting list) and what would unblock it, then stop.
2. Claim the first one, or the one the operator named ($ARGUMENTS), with `node .agents/scripts/board.mjs claim <id> --agent <your name>`.
3. Build it, check it (`docs/rules/testing.md`), review it ("Item review" in `docs/rules/review.md`), finish it against the definition of done, and make its save point (`docs/rules/git.md`). Then release the claim.
4. Tell the operator in plain words what now works, how to try it, and anything they need to do. Suggest a fresh session for the next item.
