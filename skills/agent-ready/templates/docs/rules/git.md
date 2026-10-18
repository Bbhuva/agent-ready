# Save points, merges and deploys

Load this before any commit, merge or deploy. The operator overrides in `AGENTS.md` beat anything here.

## Save points

Every finished item becomes a **save point**: one local commit the operator can go back to. Nothing leaves the computer until the operator says *deploy*.

1. **When:** right after an item meets the definition of done in `docs/rules/workflow.md`, and its item review has passed. Never in the middle of an item. (Mid-item, the agent tool's own undo or checkpoints cover you.)
2. **How:** check which branch you are on. Stage only the files this item changed, by name. Never `git add -A` or `git add .`: another agent's unfinished work may be in the tree. Then commit with a message that names the item, like `feat(auth-003): sign in with an email code` (Conventional Commits: `feat`, `fix`, `docs`, `test`, `chore`, `security`).
3. **Never push a save point.** Pushing is part of deploying, and deploying is the operator's call.
4. **Going back:** when the operator says "undo auth-003" or "go back to before auth-003", find the commit with `git log --oneline` and run `git revert <commit>`. That adds a new commit that undoes it, so nothing is lost and it can be undone again. Never reset or rewrite history to go back.
5. **Parallel mode:** builders commit to their own `agent/<id>` branch as they go. The merge into the main branch is the save point (`docs/rules/parallel.md`).

{{SAVE_POINTS: delete this line to keep the default. If the operator turned save points off, write the override here too, e.g. "The operator commits by hand (override, <date>). Leave changes uncommitted and list them when an item is done."}}

## Deploying

{{DEPLOY_RULE: e.g. "The word *deploy* from the operator is the only trigger. Then: run the before-deploy checks in `docs/rules/testing.md`; give the 'Not released yet' section of `docs/changelog.md` today's date; commit that with `[Deploy]` in the message; push `main`. The host deploys `main`. Tell the operator what went out, in plain words, from the changelog."}}

**Try it before it goes live.** If the host makes a preview link for each branch, offer to push a preview branch first so the operator can click around. Pushing a preview branch is still a push: do it only when the operator says yes.

## Always

- Run the before-commit checks in `docs/rules/testing.md`.
- Never skip git hooks (`--no-verify`). If a hook fails, fix the cause. The pre-commit check refuses any commit that adds a secret file or a real-looking key.
- Never rewrite shared history: no force push, no hard reset, no deleting a branch with unmerged work. Undo with `git revert`. Rebasing your own unpushed `agent/<id>` branch is fine.

{{BRANCHING: delete this line if everything goes straight to `main`. Otherwise describe it, e.g. "Each item gets a pull request into `main`. The operator merges."}}
