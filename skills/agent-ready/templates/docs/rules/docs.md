# Documentation

Load this when you write docs, or when a change alters how the project is set up, run or used. The operator overrides in `AGENTS.md` beat anything here.

Docs change in the same item as the code they describe. An item is not done while a doc it affects is out of date.

## What to keep current

| Doc | Who it is for | Update it when |
| --- | --- | --- |
| Doc comments in the code | Agents and developers | You add or change a public function, module, API route or config option. Say what it does and why, not how. Skip the obvious |
| `README.md` (the root, and one per app in `apps/`) | Developers | Setup steps, commands or the folder layout change |
| `docs/architecture.md` | Everyone | You add an app, a service, a table or an outside API, or change how the parts talk to each other |
| `docs/operator/guide.md` | The operator, in plain words | Anything they do changes: running it, adding a key, deploying, undoing a deploy, where to look when it breaks, what it costs |
| `docs/operator/run.md` | The operator, who types these themselves | A command to start, stop, test, build or install changes, or a row that said "Not ready yet" can now be filled in |
| `docs/operator/todo.md` | The operator | You need them to do something (see below) |
| `docs/operator/launch.md` | The operator | Something on the launch list changes: a new paid service, a new kind of user data, a new email the app sends |
| `docs/words.md` | Everyone | A new thing gets a name, or you notice two names for one thing |
| `docs/changelog.md` | The operator and the people using it | An item changes something a user would notice. One plain line, under "Not released yet" |
| `.env.example` | Everyone | You add, rename or remove an environment variable. The name and a comment, never a value |
| `docs/stack.md` | Agents | A library, service or folder is added or removed, with the operator's OK |

Decisions and known problems go in `docs/build/decisions.md` and `docs/learning.md`, as `docs/rules/workflow.md` says.

## Generated docs

When the stack can generate reference docs from the code (for example an OpenAPI file from API route schemas, or TypeDoc from TypeScript), set that up as an item and generate them into `docs/reference/`. Never edit generated files by hand: fix the code and generate again. Add the command to Commands in `AGENTS.md`.

## Writing for the operator

The operator may not be a developer. In `docs/operator/` and `docs/changelog.md`:

- Use plain words. When a technical word is needed, explain it once, in brackets or in the guide's word list.
- Number the steps. Say where to click and what to type, for Windows and Mac if they differ.
- Say what they should see when it worked, and what to do if they don't.
- Never ask them to paste a key or password into a chat. Say which file or settings page it goes in.

## The operator's to-do list

Anything an agent cannot or must not do itself goes in `docs/operator/todo.md`, with an `op-` ID, exact steps, and the items it blocks:

- installing software on their computer (Node.js, Docker, a phone simulator and so on);
- signing up for a service, creating a project in a dashboard, verifying a domain;
- getting an API key and putting it into `.env` (with `node .agents/scripts/keys.mjs add <NAME>`, which they run themselves) or the host's settings;
- setting a spending limit and billing alert on every paid service;
- paying for anything, accepting terms, publishing to an app store;
- giving access: inviting an agent's account, adding a deploy key, approving a hook.

Not on the list: anything the operator answers in the chat (a question, a choice, a yes to a plan), and anything they can do right now while you wait (restarting the tool after setup). Ask for those in the chat. An entry is only for work they do later, outside the chat.

Write each entry under "Waiting on you", most urgent first. If it blocks a launch, say so in the title:

```markdown
- [ ] **op-NNN** Short title in plain words `install | sign up | key | money | access`
  - **Why:** one sentence: what it unlocks.
  - **Blocks:** the item IDs waiting on it, or "nothing yet".
  - **Steps:**
    1. Exact steps: which website, what to click, what to type. Assume no technical knowledge. Give Windows and Mac steps if they differ.
  - **Where the result goes:** e.g. "In a terminal in the project folder, run `node .agents/scripts/keys.mjs add STRIPE_SECRET_KEY` and paste the key when asked (it shows stars). Don't send it to me." or "Reply with the project URL. It is not secret."
  - **How we'll know it worked:** what they will see, or the check you will run, e.g. "`node .agents/scripts/keys.mjs` shows STRIPE_SECRET_KEY as set".
```

For every paid service, add a second entry right after the sign-up:

```markdown
- [ ] **op-NNN** Set a spending limit on <service> `money`
  - **Why:** a bug can run up a large bill overnight. A limit stops it.
  - **Steps:** 1. Open <service's billing page>. 2. Set a monthly limit of <amount>. 3. Turn on an email alert at <half of it>.
```

Items that need one list its ID in `Depends`, so the board shows them as waiting, and you carry on with other work. When the operator says "op-NNN done", check it worked if you can (for keys: `node .agents/scripts/keys.mjs` shows the name as set, never the value), tick it, add `**Done:** <date>`, move it under "Done", and continue. Never run `keys.mjs add` yourself, and never ask for a key in the chat. Trying something on a real device or with a real card is a check, not a to-do: it goes in `docs/operator/mtest.md`.
