# Tech stack

Chosen {{DATE}}: {{"operator decision", or "agent recommendation, approved by the operator"}}. Agents read this before adding a library or a service. Changing anything here is the operator's call: propose it and log it in `docs/build/decisions.md`.

## What the project needs

{{The answers that shaped the choice, one line each: where people use it; what it needs (accounts, data, payments, live updates, AI, jobs); how many users and how sensitive the data; what the operator already knows or uses; the budget. For an existing project: "Taken from the repo on <date>."}}

## The stack

| Part | Choice | Why |
| --- | --- | --- |
| Language | {{e.g. TypeScript}} | {{e.g. one language for the app, the server and the scripts}} |
| App framework | | |
| UI and styling | | |
| Database | | |
| Sign-in | | |
| Hosting | | |
| {{Payments, email, AI, jobs: only the rows this project needs}} | | |
| Tests | {{unit and end-to-end tools}} | |
| CI | {{e.g. GitHub Actions running lint, type checks and tests on every push}} | |

## Layout

`docs/` holds documents only. Code, and anything built from it, lives here:

| Folder | What goes there |
| --- | --- |
| {{e.g. `apps/web`, or `src/` for a single app}} | {{e.g. the web app}} |
| {{e.g. `packages/shared`}} | {{e.g. code the apps share. Delete the row if there is one app}} |
| `scripts/` | {{developer scripts, e.g. seeding the database}} |
| `outputs/` | {{files the project produces for people to keep, such as reports or exports. Delete the row if there are none}} |
| `.agents/` | Agent tools: the guards, the scripts, the commands, and this skill for re-runs |

Build output (`.next/`, `dist/`, `build/` and the like) stays where the tools put it, and git ignores it.

## Cost at the start

{{Per month, per service, and what makes it go up.}}

## Accounts the operator needs

- {{Service: what it is for. The operator signs up; agents never do.}}

## Considered, not chosen

- {{Alternative: why not, and when it would be the better pick.}}

## Rules for agents

- Use what is listed here before adding anything new. A new library or service needs a reason in `docs/build/decisions.md`.
- Use current stable versions, and check the official docs rather than memory: APIs change.
- {{Stack-specific rules, e.g. "Database access happens only in server code, never in client components."}}
