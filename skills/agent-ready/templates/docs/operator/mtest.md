# Manual checks

Checks an agent cannot do on its own: a real phone, a dashboard only the operator can log in to, a real payment, a real email inbox, how something looks and feels. Every entry has a fixed ID, so you can report a result in one line, like "MTEST-AUTH-001 passed" or "MTEST-AUTH-002 failed, screenshot attached".

Setting something up for a check (an account, a key, an install) is not a check. That goes in `docs/operator/todo.md`.

## How to write an entry

```markdown
### MTEST-<AREA>-NNN: what this proves

- **Item:** the item ID it checks, e.g. auth-003 (phase 1)
- **Status:** pending | passed (<date>) | failed (<date>, what happened)
- **Why a human:** needs a real phone / dashboard access / a real card / your eyes
- **Steps:**
  1. Exact step. Assume the reader is not technical: say where to click and what to type.
  2. ...
- **Expected:** what you should see if it works.
- **Send back:** pass or fail, plus a screenshot or the number it printed.
```

- Agents: write steps a non-technical person can follow without asking you anything.
- Put the most important entries at the top of **Pending**. If something blocks a launch, say so in its title.
- When a result comes back, update the status and act on failures. A failure reopens its item, or becomes a bug item.
- A phase is not done until the operator has run its pending entries.

## Pending

## Done
