# Handoff: {{topic or item ID}} ({{date}})

Start here. This note is enough to pick up the work without reading the chat that produced it. Copy this template to `docs/build/handoffs/<date>-<topic>.md`, or to `docs/build/handoffs/<id>.md` when it is a builder's report on one item. Don't edit the template itself.

## Where things stand

{{Two or three sentences: the phase and the items involved, what works now, what does not yet, whether anything is committed, merged or deployed.}}

## What changed

- `path/to/file`: {{what and why}}

## Checked, and not checked

- Checked: {{command or test, and the result}}
- Not checked: {{what, and why not}}

## Claims and worktrees

- {{Items you still hold on the board, any worktree and `agent/<id>` branch, and whether the next agent should keep or release them}}

## Open decisions (the operator's call)

1. {{The question, the options, the recommended one and why.}}

## Next steps, in order

1. {{item ID and what to do}}

## Watch out for

- {{Gotchas met on the way.}}

## For the shared files

Builders in parallel mode don't edit shared files; the coordinator copies these in after the merge. Everyone else: add them yourself, then delete this section.

- **Done line:** {{`**Done:** <date>. What changed, where the tests are.`}}
- **Decisions:** {{for `docs/build/decisions.md`}}
- **Learnings:** {{for `docs/learning.md`}}
- **Changelog:** {{a plain line for `docs/changelog.md`, or "none"}}
- **Manual checks:** {{entries for `docs/operator/mtest.md`}}
- **Operator to-dos:** {{entries for `docs/operator/todo.md`: installs, sign-ups, keys, spending limits, payments}}
- **New words:** {{for `docs/words.md`}}
- **Docs changed:** {{guide, architecture, README, `.env.example`}}
- **Item review:** {{what the review in `docs/rules/review.md` found, and what was fixed}}
