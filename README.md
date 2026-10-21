# agent-ready

Set up any project for AI coding agents in one go: a short map every tool follows, detailed rules loaded only when needed, agile phase plans that survive between sessions, and guards that keep agents away from your secrets.

Works with Claude Code, Codex, Cursor, OpenCode, Gemini CLI or Antigravity, and any tool that reads `AGENTS.md`. Made for people who build with agents every day, including people who would not call themselves developers.

## The problem it solves

AI agents are fast, but out of the box they:

- forget what was decided last session, and quietly undo it;
- read your `.env` file and paste your keys into the chat;
- run `git reset --hard` or a force push and wipe out work;
- say "done" without checking, and leave you no list of what still needs a human;
- start from zero every time, because nothing was written down;
- pile up dead code and half-used files, because nobody stops to review and clean up.

agent-ready fixes this with plain files and six small scripts. No service, no account, no dependencies.

## What you get

| File | What it does |
| --- | --- |
| `AGENTS.md` | The short map every tool reads first, under 100 lines: your standing overrides, who decides what, the session loop, the project's commands, the hard "never" list, and which doc to load for which job. |
| `CLAUDE.md`, `GEMINI.md` | A pointer to `AGENTS.md`, so there is only one set of rules. |
| `docs/rules/workflow.md` | How work flows: phases, items, the definition of ready and done, dependencies, blocked and stale claims, no deadlocks between agents, changes of plan, handoffs. |
| `docs/rules/parallel.md` | Several agents at once: a coordinator, one git worktree and branch per item, builder reports, and a fixed merge sequence. |
| `docs/rules/testing.md` | When to run which checks, what every item must test, the coverage floor, critical-code rules, flaky tests. |
| `docs/rules/docs.md` | Which docs agents keep current and when, generated reference docs, and how to write for a non-developer. |
| `docs/rules/git.md` | Save points after every finished item, going back with `git revert`, merges and deploys, which you control. |
| `docs/rules/review.md` | A fresh-eyes review of every item before it is saved, and the phase-end adversarial review of the whole codebase, cleanup and a short retro. |
| `docs/rules/bugs.md` | Fixing problems: a clear report, a failing test first, the cause named before anything changes, then the fix. |
| `docs/build/README.md` | The roadmap: every phase, its goal and status, and what is waiting on you. |
| `docs/build/phases/` | One folder per phase: `brief.md` (what you asked for, in your words, agreed before planning), `plan.md` (goal, exit criteria, iterations of items with IDs, stories, dependencies, the files each one touches, acceptance checks and tests) and `review.md`. |
| `docs/build/backlog.md` | Everything wanted but not yet planned into a phase, most important first. |
| `docs/build/decisions.md` | Every decision, with the reason, so nobody asks twice and no agent reverses one by accident. |
| `docs/build/graph.md` | Made by the board: a Mermaid picture of the dependencies, and which items touch which files. |
| `docs/operator/run.md` | **Run it yourself:** the commands to start it, stop it, test it and build it, on one page, with what you should see. Agents keep it true as the project changes. |
| `docs/operator/todo.md` | **Your to-do list:** everything an agent can't do for you, such as installing software, signing up, adding an API key or paying, with exact steps in plain words. |
| `docs/operator/mtest.md` | Checks only you can do (a real phone, a dashboard, a payment), with IDs, so you report "MTEST-AUTH-001 passed" and the agent knows what that means. |
| `docs/operator/guide.md` | How to run your project in plain words: start it, see it live, add a key, go back to a save point, try a change before it goes live, ship, undo a bad deploy, report a problem, keep costs down. Agents keep it current. |
| `docs/operator/launch.md` | Before you go live: spending limits, legal basics, domain and email, phones and accessibility, error alerts, backups. |
| `docs/words.md` | One name for each thing in your project, used in chat, docs and code, plus plain meanings of the technical words agents use. |
| `docs/stack.md` | The tech stack, why it was chosen, where the code lives, what it costs, and which accounts you need. |
| `docs/architecture.md` | How the parts fit together, with a diagram. Updated whenever a part is added. |
| `docs/changelog.md` | What changed for your users, in plain words. |
| `docs/product.md` | For new projects: your idea turned into a short brief before any code is written. |
| `docs/security.md` | Security rules for agents, where secrets live, what is public, and a go-live checklist in plain words. |
| `docs/learning.md` | Known problems and their fixes. Agents check it when something fails, before debugging from scratch. |
| `.agents/scripts/board.mjs` | The board: shows what is ready and who holds what, refuses claims on items or files already being worked on, checks the plans for circular dependencies, draws the graph, and in parallel mode starts builders in their own worktrees and merges them in order. |
| `.agents/scripts/keys.mjs` | You add a key in your own terminal without it showing on screen or going into a chat. Agents can check which keys are set without ever seeing a value. |
| `.agents/commands/`, `.agents/scripts/commands.mjs` | Your `/ar-` commands, written once and installed into each tool's own format. `docs/operator/commands.md` lists them. |
| `.agents/skills/agent-ready/` | A copy of this skill, so `/ar-setup` can check the setup without downloading again. |
| `.agents/scripts/update.mjs`, `.agents/agent-ready.json` | The updater, and its record of the installed version and of agent-ready's own files, so an update can tell them apart from your changes. |
| `.agents/scripts/health.mjs` | Checks the whole setup in plain words: the map, the docs, whether each tool runs the guard, the secret check on commits, the plans, missing keys, leftover worktrees. |
| `.agents/hooks/guard.mjs` | Blocks agents from reading secret files and running destructive commands. In parallel work it also blocks writes into files another agent has claimed: structured edits, and shell commands that name the file they write (it can't see what scripts or build tools write). |
| `.agents/hooks/precommit-guard.mjs` | Refuses any commit that adds a secret file or a real-looking API key, whoever makes it. |

`docs/` holds documents only. Your code goes in folders chosen with the stack: the framework's usual layout for one app, or `apps/` and `packages/` when there are several.

## Install

Open your agent in your project folder and paste this (from [PROMPT.md](PROMPT.md)), with your idea on the last line:

```text
Set up this project with agent-ready: https://github.com/Bbhuva/agent-ready

1. Ask me once for permission to create and edit files in this folder and run the setup commands, for the whole setup.
2. Download it: git clone --depth 1 https://github.com/Bbhuva/agent-ready .agent-ready-download
   (No git? Download https://github.com/Bbhuva/agent-ready/archive/refs/heads/main.zip and unzip it into .agent-ready-download.)
3. Follow skills/agent-ready/SKILL.md from the download, step by step. It builds every folder and file.

My project: <your idea, or "existing project">
```

Already use the skills installer? `npx skills add Bbhuva/agent-ready`, then tell your agent *"Set up this project with agent-ready"*, with your idea in the same message.

The agent downloads the skill, looks around, and asks you at most five questions (each with a suggested answer). Then it shows you every file it will create and asks **once** for permission to create them all, with a tip for your tool so it doesn't stop at every file. After your yes it builds the whole structure in one go. It never overwrites your files, never reads your `.env`, and never commits during setup. A copy of the skill stays in `.agents/skills/agent-ready/`, so `/ar-setup` can check the setup later without downloading again.

**Updating.** Type `/ar-update`. It shows the version you have, the newest one and what's new, and waits for your yes. Then it replaces agent-ready's own files (the guards, scripts and commands), keeps any you changed, and never replaces your documents: an agent offers each document change one at a time. Projects set up before version 1.0.0 have no `/ar-update` yet; paste the install prompt above and the agent updates instead of setting up again.

**No tech stack in mind?** For a new project it adds five quick questions (where it runs, where people use it, what it needs, which languages you already know, and how big, how sensitive and what budget). Then it recommends a stack that fits what you are building, with the reasons, the monthly cost and the accounts you need, plus one alternative. There is no house stack: a language you know is suggested when it does the job well, and you're told plainly when it would hold you back. A tool that runs only on your computer gets a local setup, with no hosting and no cloud accounts.

**Your instructions win.** Anything you tell it, like "don't run checks on each commit" or "use Python", beats its defaults. Standing instructions are written into `AGENTS.md` as overrides, so every agent after it follows them too.

## Commands

Type these in your agent's chat. Forgot one? `/ar-help` lists them all, and so does `docs/operator/commands.md` in your project.

| Command | What it does |
| --- | --- |
| `/ar-help` | Lists every command, and suggests the ones that fit right now |
| `/ar-status` | Where the project stands: the phase, what's ready, in progress or waiting, and your to-dos |
| `/ar-next [item]` | Takes the next ready item and sees it through: claim, build, check, review, save |
| `/ar-run` | Starts the app on your computer and gives you the link, with no commands to type |
| `/ar-test` | Runs all the checks and tells you in plain words whether everything works |
| `/ar-todo [op-ID done]` | What the agents need from you, or marks one done |
| `/ar-keys` | Which keys are set or missing (names only), and how to add one safely |
| `/ar-shape [idea]` | Talks a new phase or feature through, and agrees a short brief before planning |
| `/ar-plan` | Plans the next phase from its approved brief |
| `/ar-review [phase]` | Reviews the current change, or the whole codebase at the end of a phase, plus cleanup |
| `/ar-bug [what happened]` | Reports a problem; the agent finds the cause and fixes it with a test |
| `/ar-undo [item]` | Goes back to before a finished item, without losing anything |
| `/ar-deploy` | Ships it: checks, changelog, push, and what went out |
| `/ar-handoff` | Writes a note so the next session can carry on |
| `/ar-explain [what]` | Explains something in plain words |
| `/ar-rule [instruction]` | Adds a standing instruction every agent follows from now on |
| `/ar-health` | Checks the setup is still sound |
| `/ar-launch` | Goes through the before-you-go-live checklist |
| `/ar-coordinate` | Runs several agents at once, and merges their work in order |
| `/ar-setup` | Sets up the project, or checks the setup |
| `/ar-update` | Gets the newest agent-ready, without touching your documents or plans |

They are written once, in `.agents/commands/`, and `node .agents/scripts/commands.mjs install` turns them into each tool's own format:

| Tool | Where they go | How you type them |
| --- | --- | --- |
| Claude Code | `.claude/commands/` | `/ar-help` |
| Cursor | `.cursor/commands/` | `/ar-help` |
| Gemini CLI | `.gemini/commands/` | `/ar-help` |
| OpenCode | `.opencode/commands/` | `/ar-help` |
| Codex | Your home folder (`~/.codex/prompts/`), only if you say yes | `/prompts:ar-help` |
| Antigravity, others | Nowhere: `AGENTS.md` tells the agent where to look | `ar-help` (no slash) |

## Several agents at once

Choose "several at the same time" during setup and the project runs in parallel mode:

1. **A coordinator** (usually the session you talk to) runs `board.mjs next` to pick items whose files don't overlap, and `board.mjs start <id>` for each. That claims the item, makes its worktree and `agent/<id>` branch, and prints a brief to hand to the builder.
2. **Each builder** works in its own worktree on one item, commits only to its branch, and finishes with a report. The separate worktree is what keeps builders apart. On top of that, the guard refuses edits outside the builder's item files, and edits into them from anyone else. It sees structured edits and shell commands that name the file they write, not what scripts or build tools write.
3. **The coordinator merges** with `board.mjs merge <id>`, one branch at a time, in dependency order, after you say "merge". It rebases, runs the checks on the branch and again after merging, ticks the item, and cleans up the worktree and branch. If the checks fail after merging, it undoes the merge, confirms the undo worked, and hands the item back to its builder. Once it is fixed, the next merge brings back all of that item's work, not just the fix. If the undo itself fails, it says so and marks the item blocked, never done.
4. **Stopped partway?** A builder that stops releases its claim, and the item shows as paused. The next one picks it up with `board.mjs resume <id>`, keeping its worktree, branch and handoff. A fresh claim held by someone else can't be taken.

The board is what keeps builders apart. Claims live inside the git folder, which every worktree shares, so a second agent cannot take an item that is already taken, or one that touches the same files.

```bash
node .agents/scripts/board.mjs claim auth-003 --agent codex-1
```

## Can I use Obsidian?

Yes, but you don't need it. The docs are plain markdown, so you can open the project folder as a vault and browse them. Agents don't use Obsidian's graph. They need hard facts: which items depend on which, and who is touching which files. The board gives them that, and `node .agents/scripts/board.mjs graph` draws it as a Mermaid diagram in `docs/build/graph.md`, which shows up on GitHub, in VS Code and in Obsidian.

## What the guard blocks

| Blocked | Why |
| --- | --- |
| Reading or writing `.env`, `.env.local`, `.env.production` and other env files | Your keys. `.env.example` (names only) stays readable. |
| Private keys, `~/.ssh`, `~/.aws`, service account files, `.dev.vars`, `secrets.toml`, Terraform state | Also secrets. |
| `printenv`, `env`, `Get-ChildItem env:` and similar | They print every environment variable, keys included. |
| `git push --force`, `git reset --hard`, `git clean -f`, `git checkout -- .`, `git branch -D` | They destroy work, often someone else's. (`--force-with-lease` is allowed.) |
| `rm -rf` on the project, home or root folder | No comment needed. |
| `DROP TABLE`, `TRUNCATE TABLE`, resetting a linked or remote database | Data loss. |
| `curl ... \| bash` and its PowerShell twin | Runs downloaded code nobody has read. |
| `--no-verify`, `HUSKY=0` | They switch off the secret check. |

When the guard blocks something, the agent is told not to look for another way and to ask you instead. Edit the lists at the top of `guard.mjs` to fit your project.

**It is a seatbelt, not a vault.** It catches the normal ways an agent reads a file or runs a command. It cannot stop every possible trick. Keep production keys in your host's secret settings, and replace any key that was ever pasted into a chat, a screenshot or a commit.

## Which tools are covered

| Tool | Reads the rulebook | Guard | How it was checked |
| --- | --- | --- | --- |
| Claude Code | Through `CLAUDE.md` (`@AGENTS.md`) | `PreToolUse` hook plus deny rules in `.claude/settings.json` | Exact hook command run through bash, cmd and PowerShell with Claude Code's documented input |
| Codex | Yes | `PreToolUse` hook in `.codex/config.toml`. Approve it once from the hook-approval icon in the Codex app's bar. No icon? `node .agents/scripts/codex-guard.mjs` opens Codex's terminal version for you and says what to press | Same |
| Cursor | Yes | `beforeReadFile` and `beforeShellExecution` in `.cursor/hooks.json` | Same |
| OpenCode | Yes | Plugin in `.opencode/plugins/` | Plugin loaded and called in the test suite |
| Gemini CLI, Antigravity | Yes | `BeforeTool` hook in `.gemini/settings.json` | Documented input format only |
| Copilot, Windsurf, others | Yes | No hook support known. The git check still applies | |

**Not yet confirmed inside a live session of each tool.** Every claim above is tested against each tool's documented hook format, but a live run in each tool is still to do. After setup, the skill has every tool prove it with a harmless decoy file (`.env.agent-ready-check`): the agent tries to read it and must be blocked.

Open questions:

- **Cursor:** its docs do not say whether a hook's "allow" answer skips your normal approval prompt for shell commands. If you rely on those prompts, check after setup.
- **Antigravity:** it replaced Gemini CLI in June 2026 and may read hooks from a different place. Check with `/hooks`.

## How you work after setup

- Agents read `AGENTS.md` at the start of every session and load the rest only when a task needs it. Most tools do this on their own.
- **Work moves phase by phase.** Each phase ends with something you can try. `docs/build/README.md` always shows where things stand.
- **Before a new phase or a big feature,** the agent asks you a few plain questions, each with a suggested answer, and writes a one-page brief in your words. Nothing is planned until you say yes to it.
- **Every item is reviewed** with fresh eyes before it is saved: does it do what was asked, what breaks it, is anything unsafe, do the tests mean something.
- **At the end of each phase,** the agent suggests an adversarial review of the whole codebase and a cleanup of unused files and code. Say yes, or skip it.
- **Something broken?** Report it the way `docs/operator/guide.md` shows. The agent makes it happen, writes a failing test, names the cause, and only then fixes it.
- **Add keys yourself:** `node .agents/scripts/keys.mjs add STRIPE_SECRET_KEY`. What you type shows as stars and never goes near a chat.
- **Going live?** Work through `docs/operator/launch.md` with an agent: spending limits, legal basics, domain and email, phones, backups.
- **Now and then,** ask for `node .agents/scripts/health.mjs`. It tells you in plain words whether the setup is still sound.
- **Say "from now on..."** and it becomes an override in `AGENTS.md` that every agent follows.
- **Every finished item becomes a save point** you can go back to ("undo auth-003"). Nothing leaves your computer until you say so (for example **deploy**), and how it ships fits your project: a host, an app store, a package, or nowhere at all.
- **`docs/operator/todo.md` is your to-do list.** When an agent needs you to install something, sign up, add a key or pay, it adds an entry with exact steps and carries on with other work. Say "op-003 done" when you finish one. Never paste a key into the chat; each entry says where it goes.
- `docs/operator/mtest.md` is your list of checks only you can do. Report results by ID.
- `docs/operator/guide.md` explains how to run, ship and undo things, in plain words.
- Before you close a session partway through, ask for a handoff note.
- When the same problem bites twice, ask the agent to add it to `docs/learning.md`.
- Skim `docs/build/decisions.md` now and then. Anything marked "agent default, please confirm" is waiting for you.

## By the numbers

- **About 1,400 tokens loaded per session.** `AGENTS.md` is an 80-line map, kept under 100 lines by rule and under 80 by this repo's tests. The other rules (about 9,500 tokens in seven files) load only when a task needs them.
- **One skill, one entry** in your agent's skill list (about 240 tokens), however much it sets up.
- **Enforced by code, not by asking nicely:** reading secrets, destructive commands, committing keys and two agents claiming the same files are all refused by scripts. Writes into another agent's claimed files are refused for structured edits and for shell commands that name the file; scripts and build tools are not covered, and separate worktrees do the real isolating.
- **125 automated tests** cover the guards, the commit check, the board, parallel merges in real git worktrees, the key helper, the health check, the commands in every tool format, and the paste-in prompt.

Not measured yet: total tokens per task compared with no setup, and live runs inside every tool. The hooks are tested against each tool's documented input format.

## Why it is built this way

- **One short map.** Tools change every few months. `AGENTS.md` is read by nearly all of them, so your rules move with you. It stays short because every tool loads it into every session.
- **Load on demand.** Agents read the map and nothing else until a task needs more. Big context makes agents worse, not better.
- **Small slices, reviewed often.** Phases end in something you can try, items are small enough for one session, and every phase ends with a hard look at the whole codebase. Mistakes are cheapest to fix early.
- **You have the last word.** Your instructions beat every default, and they are written down so the next agent knows them too.
- **Agree before you build.** A short plain-words brief before every phase catches the misunderstanding before it becomes code.
- **Every step can be undone.** Each finished item is a save point, and going back adds a commit instead of deleting one.
- **Humans own what cannot be undone.** Deploys, merges, money, accounts and production data wait for a person.
- **Write it down.** Decisions, problems, manual checks and handoffs live in files, because chat history does not survive.
- **Seatbelts, not trust.** Rules in a markdown file are advice. Hooks and git checks are enforcement.

## For contributors

```bash
npm test
```

Runs everything above. No dependencies, nothing to build: the paste-in prompt downloads the skill straight from this repo, so what you push is what people get.

In any project after setup, the guards and the setup can check themselves:

```bash
node .agents/hooks/guard.mjs --self-test
```

```bash
node .agents/scripts/health.mjs
```

## License

MIT
