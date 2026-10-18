# Known problems and fixes

> **For every AI agent working here.** Do not load this file by default. Open it when something fails unexpectedly: a command errors, a hook refuses a commit, a path comes out wrong, a test fails on something you just wrote. If the answer is here, use it and move on. If you solve a new problem, add it.
>
> Keep entries short: what you saw, why it happened, the fix. Newest at the top of its section. Delete an entry only when its cause is gone from the repo.

## Shell and paths

- **Example entry, replace me.** *Saw:* `npm test -- some-file` ran every test. *Why:* the test runner ignored the filter after `--`. *Fix:* `npx vitest run some-file`.

## Git and commits

- **The agent-ready guard blocked a command.** *Why:* it touched a secret file, or it could destroy work. *Fix:* do not look for another way. Ask the operator to do that step.
- **The pre-commit check refused a commit.** *Why:* a staged file is a secret file, or a line looks like a real key. *Fix:* move the value into `.env` and read it from the environment. Never use `--no-verify`.

## Tools and dependencies

## Tests

## Deploys and hosting
