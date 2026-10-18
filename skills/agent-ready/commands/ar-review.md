---
description: Review the current change, or (with "phase") the whole codebase at the end of a phase, plus cleanup.
argument-hint: "[phase]"
---
Review work as `docs/rules/review.md` says. What the operator typed: $ARGUMENTS

- **Nothing after the command:** an item review of the current change (`git diff` and any new files) against the item it belongs to. Fix what you find, then say what you checked.
- **"phase":** the phase-end review of the whole codebase, then the cleanup, the write-up from `docs/build/templates/phase-review.md`, and the retro. Start with `node .agents/scripts/health.mjs`. If you built this phase yourself, say that a fresh session or a different tool would review it better. Show the operator the list of files you plan to delete and wait for a yes.
