# Phase {{N}}: {{NAME}}

Planned {{DATE}}. Approved by the operator: {{date, or "waiting"}}.

Copy this file to `docs/build/phases/phase-<N>-<name>/plan.md`. The item format and the rules for ready, done and dependencies are in `docs/rules/workflow.md`. Shaped from: [brief.md](brief.md), approved {{date}}.

## Goal

{{What the operator can do or see when this phase is done, in one or two sentences a non-developer would understand.}}

## Exit criteria

The phase is done when all of these are true:

- [ ] Every Must item below is `[x]`.
- [ ] {{Each key user journey that now works end to end, with its end-to-end test or its entry in `docs/operator/mtest.md`.}}
- [ ] The full test suite passes, and coverage is at or above the floor in `docs/rules/testing.md`.
- [ ] The operator has run this phase's manual checks, and `docs/operator/guide.md` and `docs/changelog.md` are current.
- [ ] `node .agents/scripts/board.mjs check` passes.

## Not in this phase

- {{Things people might expect here that are left out on purpose, and where they went (backlog, a later phase).}}

## Iteration A: {{name}}

Items in one iteration never depend on each other, so they can be built in parallel. They may depend on earlier iterations.

- [ ] **{{prefix}}-001** {{Short title}} `story · M · Must`
  - **Story:** As a {{who}}, I want {{what}}, so that {{why}}.
  - **Depends:** none
  - **Touches:** `{{files or folders, in backticks: the board checks them for overlaps}}`
  - **Acceptance:**
    - Given {{a starting state}}, when {{an action}}, then {{the result}}.
  - **Tests:** {{unit, integration, end to end: what each one covers}}
  - **Notes:** {{risks, edge cases, what is out of scope}}

## Iteration B: {{name}}

- [ ] **{{prefix}}-010** {{Short title}} `task · S · Should`
  - **Depends:** {{prefix}}-001
  - **Touches:**
  - **Acceptance:**
  - **Tests:**

## Operator to-dos for this phase

The operator's part (installs, sign-ups, keys, payments, approvals) lives in `docs/operator/todo.md` as `op-` items, so the operator has one list. Items that need one name it in `Depends`. List the ones this phase needs, most urgent first:

- {{e.g. op-001 Create the Supabase project (blocks auth-001)}}

## Phase-end review

Suggested when the last Must item is done. See `docs/rules/review.md`. Result: {{a link to review.md once it is written, or "skipped by the operator on <date>"}}.
