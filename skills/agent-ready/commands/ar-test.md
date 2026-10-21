---
description: Run all the checks and tell you in plain words whether everything works.
argument-hint: "[which part to check]"
---
Run the checks for the operator. Their words: $ARGUMENTS

1. Run the item-done checks from Commands in `AGENTS.md`: the tests, plus the lint and type checks if this project has them. They are the same commands as "Run the tests" on the run card, `docs/operator/run.md`. If they named a part, run just that part's tests.
2. Answer in plain words, in a few lines: how many checks passed, and for anything that failed, what it means for someone using the app ("signing in with an email code fails"), not the stack trace.
3. If something fails, offer to fix it as a bug (`/ar-bug`). Don't change code or tests unless they say yes, and never weaken or delete a test to make it pass.
4. If there are no tests yet, say so, and name the item in the plan that adds them.
