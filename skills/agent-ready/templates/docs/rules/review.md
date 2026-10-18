# Reviews

Two kinds: a quick **item review** of every change before it is saved, and a deep **phase-end review** of the whole codebase before the next phase starts. The operator overrides in `AGENTS.md` beat anything here.

## Item review (every item)

Before you tick an item, read your own change as if someone else wrote it. Look at the whole diff (`git diff`, plus any new files), not your memory of it, and answer each question:

1. **Does it do what the item says?** Go through every acceptance check and point to the code and the test that prove it.
2. **What breaks it?** Empty input, the wrong user, a slow or failed network call, a double click, a very long text. Is each one handled or tested?
3. **Is anything unsafe?** A permission checked only in the UI, input trusted without checking, a secret in code or in a browser-visible variable, user content shown as raw HTML, a query built by joining strings.
4. **Do the tests mean something?** Would they fail if the feature broke? A test that only checks a function ran does not count.
5. **Is anything left behind?** Debug output, commented-out code, unused imports, stray files, a TODO without an item ID, files outside `Touches`.
6. **Are the docs current?** As `docs/rules/docs.md` says.

Fix what you find, then run the checks again. For items that touch sign-in, payments or user data, or when the operator asks, have the review done by a fresh session or a different tool than the one that built it.

In parallel mode, the coordinator runs this review on the builder's branch before `board.mjs merge`.

## Phase-end review and cleanup

When the last Must item of a phase is done, the agent that finished it suggests this review to the operator. It runs only when the operator says yes.

Suggest it like this: *"Phase N is done. Before phase N+1, I suggest an adversarial review of the whole codebase, then a cleanup of unused files and code. Run it now?"*

## 1. Adversarial review

The goal is to find what is broken before users do. Review the whole codebase, not only this phase's changes. Assume there are bugs, and go looking for them.

**Use fresh eyes.** The agent that wrote the code is its worst reviewer. Use a different tool if one is set up here, or at least a fresh session that has not seen the build chat. If the tool has a built-in review command, run it as an extra pass, not instead of this list.

Start with `node .agents/scripts/health.mjs`: it catches setup problems (guards not wired, blanks left in docs, code in `docs/`, leftover worktrees) before you read a line of code.

Look for:

- **Correctness:** inputs that break it (empty, huge, negative, duplicated, unusual characters), error paths that swallow failures, off-by-one mistakes, time zones, retries that charge or send twice.
- **Concurrency:** two users or two tabs at once, race conditions, locks or transactions taken in different orders (deadlocks), background jobs that overlap.
- **Security:** checks done only in the UI, one user reaching another user's data, missing input validation, injection (SQL, HTML, shell), secrets in code or in the browser bundle, missing rate limits. Work through `docs/security.md`.
- **Data:** migrations that lose data, missing indexes on busy queries, no way to restore a backup.
- **Tests:** acceptance checks with no real test, tests that assert nothing, coverage under the floor, critical code with no "not allowed" tests.
- **Performance:** queries inside loops, lists with no limit, oversized bundles.
- **Works for everyone:** every page on a phone-sized screen, by keyboard alone, with readable contrast, and images with alt text. Add what needs a real device to `docs/operator/mtest.md`.
- **Drift:** docs that no longer match the code: `AGENTS.md` (commands, map), `docs/stack.md`, `docs/architecture.md`, `docs/operator/guide.md` (try its steps), `.env.example`, decisions. Code or build output that ended up in `docs/`.

**Prove every finding.** Show the input or the steps that make it fail, or say why you could not. Drop anything you cannot back up. A short list of real problems beats a long list of guesses.

## 2. Cleanup

Remove what the project no longer uses. Behaviour must not change.

- Unused files, components, routes, scripts, assets and test fixtures.
- Dead code: functions nothing calls, unused exports, unreachable branches, commented-out blocks, feature flags that are always on.
- Duplicates: two helpers doing the same job. Keep one.
- Unused packages. Check with a tool for the stack (for example `npx knip` or `npx depcheck`) before removing any.
- Leftover debug output, TODOs without an item ID, temporary and scratch files.
- Handoff notes and builder reports for finished work: move them to `docs/archive/`.
- Worktrees and `agent/` branches that are already merged (`git worktree list`, `git branch --merged`), and claims the board flags as stale.

Rules:

1. Run the full test suite before you start and after you finish. Both runs must pass.
2. **Show the operator the list of files you plan to delete, and wait for a yes.** Never delete anything outside the project.
3. Keep cleanup separate from feature work, so it can be undone on its own.

## 3. Write it up

Copy `docs/build/templates/phase-review.md` into the phase folder as `review.md` and fill it in. Every finding gets a severity and one action: fixed now (a small item in a cleanup iteration of this phase), moved to the backlog as a new item, or not fixed, with the reason.

## 4. Retro, then the next phase

Answer three questions in `review.md`: what slowed us down, what went wrong more than once, and what should change. Put each change into `docs/learning.md` or the right file in `docs/rules/`, and tell the operator what you changed. Then plan the next phase from the backlog, as `docs/rules/workflow.md` says, and ask the operator to approve it.
