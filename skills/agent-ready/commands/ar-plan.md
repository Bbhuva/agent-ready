---
description: Plan the next phase from its approved brief and the backlog.
argument-hint: "[notes]"
---
Plan the next phase, as `docs/rules/workflow.md` says.

1. Find its approved brief (`docs/build/phases/<phase>/brief.md`). No brief yet, or not approved? Suggest `/ar-shape` and stop.
2. Copy `docs/build/templates/phase-plan.md` into the phase folder as `plan.md` and fill it in from the brief and the backlog: thin slices a user would notice, size S or M, acceptance checks, Tests, Depends and Touches.
3. Put everything only the operator can do in `docs/operator/todo.md` as `op-` items, and list those IDs in Depends.
4. Run `node .agents/scripts/board.mjs check` and fix what it finds, then `node .agents/scripts/board.mjs graph`.
5. Update `docs/build/README.md`. Show the operator the plan in plain words: what they will be able to try at the end, how many items, and what they need to do. Wait for their yes.

Extra instructions from the operator: $ARGUMENTS
