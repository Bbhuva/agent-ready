# Testing

Load this when you write tests or decide what proves an item is done. The project's commands are under Commands in `AGENTS.md`. The operator overrides in `AGENTS.md` beat anything here.

## When to run what

| Moment | Run |
| --- | --- |
| After an edit | The smallest check that covers it: one test file, or the one command that exercises the change |
| Item done | The item's tests, then the full unit suite, lint and type checks |
| Before a commit | {{BEFORE_COMMIT: default "The item-done checks, unless they already passed since your last change." Follow any override, e.g. "Nothing: the operator turned this off on <date>."}} |
| Before a merge (parallel mode) | The item-done checks in the builder's worktree, then again on `main` after the merge |
| Before a deploy, and at the end of a phase | Everything: the full suite with coverage, the end-to-end tests and a production build |

Don't run the whole suite after every edit. Do run it before you say an item is done.

## What every item needs

- Each acceptance check maps to at least one automated test, or to an entry in `docs/operator/mtest.md` when only a human can check it.
- New or changed behaviour gets a test for the normal case and at least one for an edge or failure case: empty input, the wrong user, the network down, a file too large.
- **Bug fixes start with a failing test** that reproduces the bug. Then fix it. The test stays, so the bug cannot come back.
- Spikes and pure config changes need no tests. Say how you checked them instead.
- **Screens work for everyone:** check each new or changed page at phone width and by keyboard alone (Tab, Enter, Esc), with labels on form fields and alt text on images. Use an automated accessibility check if the stack has one. Anything that needs a real phone goes in `docs/operator/mtest.md`.

## Coverage

- **Tool:** {{COVERAGE_COMMAND: e.g. `npx vitest run --coverage` or `pytest --cov`. If none is set up yet, setting it up is an item in phase 1.}}
- **Floor:** {{COVERAGE_FLOOR: default "70% of lines overall, set in the test config so CI fails below it".}} The floor only goes up. Raise it when real coverage stays well above it. Never lower it without the operator.
- **Files you touched** should be at least 80% covered when the item is done.
- **Critical code** (sign-in, permissions, payments, money maths, deleting data, anything in `docs/security.md`): every rule has a test, including the "not allowed" case: a signed-out user, a different user, a user without the role.
- Coverage is a floor, not the goal. A test that asserts nothing, or only that a function ran, does not count.

## Kinds of tests

- **Unit (most):** one function or component. Fast, no network.
- **Integration (some):** pieces working together, such as an API route with its database or a form with its server code.
- **End to end (few):** one per key user journey in the phase's exit criteria. Run them when an item touches one of those journeys, and at the end of every phase.

## Rules

- Test behaviour, not internals. A refactor that keeps the behaviour should not break a test.
- Mock outside services (payments, email, SMS, AI models) at the edge. Tests never call live paid APIs or contact real people.
- Each test sets up its own data and cleans up after itself. Tests pass in any order.
- **Flaky test?** Don't re-run it until it goes green. Fix it, or skip it with a bug item ID and tell the operator.
- Never delete a test or loosen an assertion to make it pass. Change a test only for an intended change in behaviour, and say so in the item's Done line.

## Invariants

Rules that must never break, each backed by a test:

{{INVARIANTS: e.g. "- Users only ever see their own rows: `tests/access.test.ts`". If there are none yet: "- None yet. When a bug could come back, write a test that would catch it and list it here."}}
