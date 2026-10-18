# How to run {{PROJECT_NAME}}

A plain-words guide for the operator. Agents keep it current: any item that changes one of these steps updates this file at the same time. If a step here does not work, tell an agent. That is a bug.

## Commands you can type

Type `/ar-help` in your agent's chat to see every command, or open `docs/operator/commands.md`. The ones you will use most:

- `/ar-status`: where things stand, and what is waiting on you.
- `/ar-next`: build the next piece.
- `/ar-todo`: your to-do list. `/ar-todo op-003 done` when you have done one.
- `/ar-bug what happened`: report a problem.
- `/ar-undo auth-003`: go back to before a finished item.

In a tool that doesn't show these commands, type the name without the slash, like "ar-status".

## What it is and where it lives

{{One paragraph: what the project is, where the code is (for example the GitHub repo), where it runs (the host), and which outside services it uses.}}

## Run it on your computer

{{Numbered steps from a fresh computer: what to install (point to the entries in `docs/operator/todo.md`), the commands to run, what you should see, and how to stop it.}}

## See it live

{{The live address, and the host's dashboard where you can see deploys and logs.}}

## Add or change a secret key

On your computer, open a terminal in the project folder and run this, with the key's name from `.env.example`:

```bash
node .agents/scripts/keys.mjs add STRIPE_SECRET_KEY
```

Paste the key when it asks. It shows stars instead of the key, and saves it in `.env`, which git never uploads. Then tell the agent "STRIPE_SECRET_KEY is set". Never paste a key into the chat. To see which keys are set (names only, never values): `node .agents/scripts/keys.mjs`.

For the live app: {{the host's settings page, with the exact menu path, and how to redeploy so a changed key takes effect.}}

## Save points: going back

Every finished item is saved as a save point on your computer. To go back, tell an agent "undo auth-003" or "go back to before auth-003". It adds a new save point that reverses that item, so nothing is lost and you can change your mind again. To see the save points: `git log --oneline`.

## Try a change before it goes live

{{If the host makes a preview link for each branch: "Say 'preview' and the agent pushes a preview branch and sends you the link. Nothing changes for your users." Otherwise: "Run it on your computer (above) and click through it."}}

## Ship a change

{{What to say to the agent (for example "deploy"), what happens next, and how to check it went out.}}

## Undo a bad deploy

{{The fastest safe way back, e.g. "In Vercel, open Deployments, pick the last good one, choose Promote to Production." Then ask an agent to undo the item that caused it.}}

## Report a problem

Tell an agent, in one message:

1. **What you did:** the steps, starting from a page address or a button.
2. **What you expected,** and **what happened instead.**
3. **Where:** your phone or computer, which browser, and whether it was the live site.
4. **When it started,** if you know (for example "after yesterday's deploy").
5. **A screenshot,** or the exact error text.

Never include keys, passwords or customer details. If one ended up in a screenshot, replace that key.

## When something breaks

{{Where to look first (the host's logs, error tracking), and what to copy and send to an agent along with the report above.}}

## Keeping costs down

- Start a fresh chat for each new piece of work. Long chats cost more and get worse.
- Before closing a chat partway through, ask for a handoff note, so the next chat doesn't need the whole history.
- Point the agent to files ("look at docs/operator/todo.md") instead of pasting long text.
- Set a spending limit on every paid service (`docs/operator/launch.md`, Money).

## Accounts and costs

| Service | What it is for | Plan and monthly cost | Who has the login |
| --- | --- | --- | --- |
| {{service}} | {{what for}} | {{free tier, or the price}} | {{you}} |

## Words

The project's own words, and the technical words agents use, are in `docs/words.md`.
