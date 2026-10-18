# Working in parallel

Load this when more than one agent works on the project, or when you are the coordinator. The operator overrides in `AGENTS.md` beat anything here.

## Modes

| Mode | When | How the code is shared |
| --- | --- | --- |
| One agent | One agent at a time (the default) | One checkout. Claim with the board anyway: it costs nothing and catches mistakes |
| Taking turns | For example, one tool plans and another builds, never at the same moment | One checkout. Claim with the board before you start, release when you stop |
| Parallel | Several builders at the same time | A coordinator, and one git worktree and branch per item |

This project uses: **{{MODE: one agent, taking turns, or parallel}}**.

## The board

`node .agents/scripts/board.mjs` reads the phase plans, the backlog and `docs/operator/todo.md`. It shows what is ready, who holds what, and what is waiting on whom. Claims live in one file inside the git folder, which every worktree of this repo shares, so it refuses a claim when the item is taken, its dependencies are not done, or its `Touches` overlap work already in progress.

| Command | What it does |
| --- | --- |
| `board.mjs` | Ready, in progress, waiting, the operator's open to-dos, problems |
| `board.mjs ready` | Items that can be started right now |
| `board.mjs claim <id> --agent <name>` | Takes an item, or says exactly why not |
| `board.mjs release <id>` | Gives it back |
| `board.mjs check` | Fails on duplicate IDs, unknown or circular dependencies, dependencies inside one iteration, and overlapping work in progress |
| `board.mjs graph` | Writes `docs/build/graph.md`: a picture of the dependencies, and who touches which files |
| `board.mjs next` | Parallel mode: the batch of ready items to start now, none touching the same files |
| `board.mjs start <id> --agent <name>` | Parallel mode: claims it, makes its worktree and `agent/<id>` branch, marks it `[~]`, and prints the builder's brief |
| `board.mjs merge <id>` | Parallel mode: the whole merge sequence below, in one step |

If the board refuses a claim, do not work around it. Pick another item, or ask the coordinator.

**The guard backs the board up.** When an item is claimed, the guard refuses any agent writing into its files from another checkout, and refuses a builder writing outside its own item's files (its report in `docs/build/handoffs/` is always allowed). It sees file writes in Claude Code, Codex, Gemini CLI, Antigravity and OpenCode. Cursor has no hook before a file edit, so there only the board and these rules apply.

Settings live in `.agents/board.json`: the main branch, where worktrees go, how many builders at once, and `checks`, the item-done commands that `merge` runs.

## Roles in parallel mode

- **Coordinator (one).** Works in the main checkout, usually the session the operator talks to. Plans with the operator, checks the board, hands out items, starts builders, merges finished work, and keeps the plans and shared docs up to date. It does not build items itself while builders are running.
- **Builders (one per item).** Each works in its own worktree, on its own branch, on one item.
- **Reviewer (optional).** A different tool, or a fresh session. Reviews a branch before it is merged, and runs the phase-end review.

## The coordinator's loop

1. Run `board.mjs check`. If it fails, fix the plan first.
2. Run `board.mjs next`. It lists up to **{{MAX_BUILDERS: default 3, set in `.agents/board.json`}}** ready items whose `Touches` do not overlap each other or anything in progress.
3. For each one, run `node .agents/scripts/board.mjs start <id> --agent <builder name>`, then open a new session for that builder in the worktree it printed, and paste the brief it printed. If the tool makes worktrees itself (a desktop app, a cloud agent), use `claim` instead of `start`, and name the branch `agent/<id>`.
4. While builders work, keep out of the files they touch. Answer their questions. If the operator is needed, add an entry to `docs/operator/todo.md`.
5. When a builder says its item is ready to merge: run the item review in `docs/rules/review.md` on its branch, then follow the merge sequence. If it is blocked instead, release the item and replan.
6. When the last Must item is merged, follow "End of a phase" in `docs/rules/workflow.md`.

## Builder rules

- Work only inside your worktree, on your branch, on your one item. Change only the files in the item's `Touches`. Need more? Ask the coordinator, who checks for overlaps before widening it.
- Commit to your own branch as you go, with messages like `feat(auth-003): ...`. In parallel mode these commits are allowed. Never merge, never push, and never touch `main`.
- Leave the shared files alone: the plans and backlog in `docs/build/`, `decisions.md`, `docs/learning.md`, `docs/changelog.md` and `docs/operator/`. Two branches editing them collide. Put what they need in your report instead.
- Before you report done: `git rebase main` in your worktree, then run the item-done checks in `docs/rules/testing.md`.
- Finish with a report: copy `docs/build/templates/handoff.md` to `docs/build/handoffs/<id>.md` on your branch and fill it in, including the parts for the coordinator. Then tell the coordinator.
- Blocked? Write the report saying what blocks you, tell the coordinator, and stop. Don't wait while holding the item.

## The merge sequence

Merge one branch at a time: an item only after everything it depends on, then the lowest ID first.

{{MERGE_APPROVAL: default "Before merging a batch, list the finished items to the operator and wait for 'merge'. The operator can make 'merge without asking' an override."}}

For each branch, run `node .agents/scripts/board.mjs merge <id>` in the main checkout. It refuses to merge an item before the items it depends on, or a branch with uncommitted or no work. Then it:

1. rebases the branch onto the main branch in its worktree. On a conflict it stops, changes nothing, and names the files: send the branch back to its builder;
2. runs the `checks` from `.agents/board.json` on the branch. If one fails, it stops and shows the output: back to the builder;
3. merges with `--no-ff`, and ticks the item with a Done line in the same commit, which becomes the save point;
4. runs the checks again on the main branch. If they fail, it undoes the merge with `git revert` (a new commit, nothing lost), keeps the claim, and says so: back to the builder;
5. releases the claim, removes the worktree, and deletes the merged branch.

Then copy the notes from the builder's report (`docs/build/handoffs/<id>.md`) into the shared files: decisions, learnings, the changelog line, manual checks and operator to-dos. When the batch is done, run `board.mjs graph` so the picture is current.

Doing it by hand instead? The steps are the same: `git rebase main` in the worktree, the checks, `git merge --no-ff agent/<id>` in the main checkout, the checks again (`git revert -m 1 HEAD` if they fail), then `release`, `git worktree remove` and `git branch -d`. Never force anything.

Pushing and deploying stay with the operator, as `docs/rules/git.md` says.

## Keeping it tidy

- `git worktree list` shows every worktree. Remove the ones whose branch is merged. Ask the operator before removing one with unmerged work.
- The board flags claims older than a day. Look in that worktree: if there is work, write a handoff for it, then release the claim.
- Builder reports for merged items move to `docs/archive/` at the end of the phase.
