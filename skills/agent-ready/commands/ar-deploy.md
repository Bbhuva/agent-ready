---
description: Ship it - run the checks, date the changelog, push, and say what went out.
argument-hint: "[notes]"
---
The operator wants to ship. Follow "Deploying" in `docs/rules/git.md`. Their notes: $ARGUMENTS

1. Make sure nothing is half-finished: every item in progress is done and saved, or left out on purpose.
2. Run the before-deploy checks in `docs/rules/testing.md`. If anything fails, stop and say what.
3. If this is the first time going live, check `docs/operator/launch.md` and say what is still unticked.
4. Do the deploy steps in `docs/rules/git.md`. Then tell them in plain words what went out (from `docs/changelog.md`) and how to see it live.
