# Build

Start here to see where the project stands. How work moves is in `docs/rules/workflow.md`.

## Now

- **Current phase:** {{e.g. "[Phase 1: walking skeleton](phases/phase-1-skeleton/plan.md)", or "none yet" for an existing project with no plan}}
- **Waiting on the operator:** {{e.g. "approve the phase 1 plan", or "nothing"}}

## Roadmap

Only the current phase is planned in detail. Later phases stay one line each until their turn.

| Phase | Goal | Status |
| --- | --- | --- |
{{ROWS: e.g. "| [1. Walking skeleton](phases/phase-1-skeleton/plan.md) | The app runs, tests run on every push, a nearly empty app is live, one thin slice of sign-up works | 0/9 done |" then "| 2. Core feature | People can create and share a list | not planned |"}}

## Also here

| Where | What it is |
| --- | --- |
| [backlog.md](backlog.md) | Everything wanted but not yet planned into a phase, most important first |
| [decisions.md](decisions.md) | Every decision and why. Append, never delete |
| `graph.md` | A picture of the dependencies and who touches which files. Made by `node .agents/scripts/board.mjs graph` |
| `handoffs/` | Notes for whoever picks the work up next. Created with the first handoff |
| [../operator/todo.md](../operator/todo.md) | What the operator needs to do: installs, sign-ups, keys, payments |
| [templates/](templates/) | Phase plan, phase review and handoff templates. Copy them, don't edit them |
