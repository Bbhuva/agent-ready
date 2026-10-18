# Your to-do list

Things only you can do: install something on your computer, sign up for a service, add a secret key, pay for something, approve something, try it on a real device. Agents add an entry whenever they need you, then carry on with other work.

**When you have done one, tell any agent "op-003 done".** Never paste a key or password into the chat. Each entry says where it goes instead.

## How agents write an entry

```markdown
- [ ] **op-NNN** Short title in plain words `install | sign up | key | money | approve | device`
  - **Why:** one sentence: what it unlocks.
  - **Blocks:** the item IDs waiting on it, or "nothing yet".
  - **Steps:**
    1. Exact steps: which website, what to click, what to type. Assume no technical knowledge. Give Windows and Mac steps if they differ.
  - **Where the result goes:** e.g. "In a terminal in the project folder, run `node .agents/scripts/keys.mjs add STRIPE_SECRET_KEY` and paste the key when asked (it shows stars). Don't send it to me." or "Reply with the project URL. It is not secret."
  - **How we'll know it worked:** what you will see, or the check an agent will run, e.g. "`node .agents/scripts/keys.mjs` shows STRIPE_SECRET_KEY as set".
```

For every paid service, add a second entry right after the sign-up: set a monthly spending limit and a billing alert.

```markdown
- [ ] **op-NNN** Set a spending limit on <service> `money`
  - **Why:** a bug can run up a large bill overnight. A limit stops it.
  - **Steps:** 1. Open <service's billing page>. 2. Set a monthly limit of <amount>. 3. Turn on an email alert at <half of it>.
```

- Most urgent first. If it blocks a launch, say so in the title.
- Items that wait on an entry list its ID in their `Depends`, so the board shows them as waiting.
- When it is done: tick it, add `**Done:** <date>`, and move it to Done.

## Waiting on you

## Done
