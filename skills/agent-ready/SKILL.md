---
name: agent-ready
description: Sets up a project so AI coding agents work safely and stay organised. Use when someone starts a new project with an AI agent, pastes a project idea, wants an existing repo made ready for agents, or wants several agents working in parallel. Creates a short AGENTS.md map, rules loaded only when needed, agile phase plans shaped with the person first, save points for every finished item, item and phase-end reviews, a bug routine, a shared word list, and an operator folder with a to-do list, manual checks, a plain-words guide and a launch checklist. Scripts claim work so parallel agents never touch the same files, run worktree merges in order, let the person enter keys without a chat, and check the setup's health. Guards block reading secrets and destructive commands. Recommends a tech stack when none is given. The person's instructions beat the defaults. Works with Claude Code, Codex, Cursor, OpenCode, Gemini CLI and Antigravity.
---

# agent-ready

You are setting up this project so AI agents, you included, can build it safely, remember what was decided, and hand work to each other. The person you are working with may not be a developer. Use plain words, ask few questions, and never hand them a wall of text.

The setup rests on four ideas:

1. **`AGENTS.md` is a short map, not a manual.** Every tool loads it into every session, so it holds only what every session needs: the operator's overrides, who decides what, the session loop, the commands, the hard "never" list, and a table of which doc to load for which job. Everything else lives in `docs/` and is loaded only when a task needs it. `CLAUDE.md` and `GEMINI.md` only point at `AGENTS.md`.
2. **Work is planned in phases, the agile way.** Each phase ends with something the operator can try. Inside a phase, small items with IDs, dependencies, the files they touch, acceptance checks and required tests are grouped into iterations that can be built in parallel. When a phase ends, the agent suggests an adversarial review of the whole codebase and a cleanup before the next phase starts.
3. **Code, not good intentions, keeps agents safe and apart.** `.agents/scripts/board.mjs` reads the plans and keeps claims in a file every git worktree shares. It refuses a claim when the item is taken, its dependencies are not done, or its files overlap work in progress. In parallel mode it starts builders in their own worktrees and merges them in order, undoing a merge that breaks the checks and saying truthfully whether the undo worked. It also lets the next agent resume paused work, and undoes an item's save points once each. The guard refuses structured edits, and shell commands that name the file they write, into another agent's claimed files. Worktrees do the real isolating: the guard cannot see what scripts or build tools write. `keys.mjs` lets the operator enter keys without a chat and lets agents check them without seeing them. `health.mjs` checks the whole setup.
4. **The operator always knows what is theirs to do.** `docs/operator/` holds their to-do list (installs, sign-ups, keys, payments), the manual checks, and a plain-words guide to running the project. `docs/` holds documents only; code lives in folders chosen with the stack.

## The person's instructions win

Anything the person tells you, in their first message or in any answer, beats a default in this skill. For example: "don't run checks on each commit", "no git hooks", "use Python", "skip the product brief", "one agent plans, another builds".

- Apply it everywhere it reaches: the questions you ask, the plan, the templates and the guards.
- If it is a standing rule, write it into the **Operator overrides** section of `AGENTS.md`, dated, so every future agent follows it. Then reword any default in `docs/rules/` that contradicts it, so the files never argue with each other.
- If it lowers security (for example, no secret check on commits), say in one sentence what it opens up, then do it their way.
- If it is ambiguous, ask once and give your recommended reading. For example, does "don't run checks on each commit" include the secret check, which takes under a second? Recommend keeping it, then follow their answer.

## Ground rules while you set up

- **Never open, print or copy a real `.env` file or any other secret file**, not even to check it. You may list file names to see whether they exist.
- **Never overwrite a file that exists.** Merge into it and show the person what you added. Never drop their existing rules.
- **Do not commit or push during setup.** Leave everything in the working tree. At the end, offer to make the setup the first save point (one local commit), and do it only on a yes.
- **Do not install packages.** Everything here is plain files plus six Node.js scripts with no dependencies.
- **Where the files are:** next to this file. `templates/`, `guards/`, `scripts/`, `commands/` and `tool-configs/` hold files for the project. `reference/` holds guides for you; never copy them into the project. If you were started from the paste-in prompt, this whole skill is in `.agent-ready-download/skills/agent-ready/`.

## Step 1. Look around before asking anything

Find out, without reading any secret:

1. **New or existing project?** Is there source code, a package manifest, git history?
2. **Which agent tools are in use?** Look for `.claude/` or `CLAUDE.md` (Claude Code), `.codex/` (Codex), `.cursor/` (Cursor), `.opencode/` or `opencode.json` (OpenCode), `.gemini/` or `GEMINI.md` (Gemini CLI or Antigravity), `.github/copilot-instructions.md` (Copilot), `.windsurf/` (Windsurf). Note which tool you are running in.
3. **Existing agent rules:** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`. Read them. Their rules must survive.
4. **The stack and its real commands:** `package.json` scripts, `pyproject.toml`, `Makefile`, `Cargo.toml`, `go.mod` and similar. Note the commands for dev, test, coverage, lint, typecheck and build.
5. **Git:** is this a repo, which branch, is there at least one commit, are there hooks already (`.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, or `git config core.hooksPath`), and are there worktrees (`git worktree list`)?
6. **Layout:** where the code lives now (`src/`, `apps/`, `packages/` and so on), and whether anything that is not a document sits in `docs/`.
7. **Secret hygiene, by name only:** does `.gitignore` cover `.env`? Does `git ls-files` list any `.env*` (other than `.env.example`), `*.pem`, `*.key` or service account file?
8. **Tools on this computer:** Node.js 18 or newer (`node --version`; the guards and the board need it), git, and anything the stack will need. Whatever is missing becomes an entry in the operator's to-do list. If Node.js is missing, offer to continue with the documents only.
9. **Instructions already given:** anything in the person's message that changes a default (see "The person's instructions win").

## Step 2. Ask, once, with defaults

Ask only what Step 1 and the person's message did not answer, in **one message**. At most five questions, each with a default, so "use the defaults" is a complete answer:

1. **What are you building, and for whom?** Skip if they pasted an idea or the repo makes it obvious.
2. **Which AI tools will you use here?** Default: the one you are running in, plus any you detected.
3. **How many agents at once?** One / taking turns (for example Claude plans, Codex builds) / several at the same time (parallel: a coordinator hands each builder one item in its own git worktree, and merges them in order). Default: one. Parallel mode needs a git repo with at least one commit; if there is none, say so and add it to the plan for their yes.
4. **How does it ship?** Save points are the same for everyone: each finished item becomes a local commit they can go back to, and nothing leaves the computer until they say so. Shipping depends on the project, so offer the default that fits what the stack and the repo show (for a new project, the recommended stack), and never name a host they have not chosen:
   - A host that deploys from GitHub (Vercel, Netlify, Cloudflare Pages, Render and similar): "When I say *deploy*, the agent pushes `main` and the host deploys it."
   - A host with its own deploy command (Fly.io, Firebase, a server of their own): "When I say *deploy*, the agent runs the host's deploy command."
   - A phone app, a package or a desktop app: "When I say *release*, the agent prepares the release and I submit or publish it."
   - Nothing to host (a script, a tool for their own computer, or too early to say): "Nothing is deployed. The agent pushes to GitHub only when I say *push*."

   If they would rather commit by hand, or want their own trigger word or commit-message marker, that is an override.
5. **Anything agents must never touch here?** For example billing, real customer emails, the production database.

**Tech stack.** If this is a new project and the stack is not clear, read `reference/stack-guide.md` and add its stack questions to the same message as a second short list. For an existing project, the stack is whatever the repo uses: don't ask.

End the message with one line: *"Anything you want done differently from the usual setup? Tell me and I'll follow it."*

## Step 3. Show the plan and wait for a yes

In one message:

- Every file and folder you will create or change, grouped (the map, the rules, the plans, the operator's folder, the agent tools, the tool settings), one line each, marked **new** or **merge**.
- The recommended stack, if you are choosing one (the short section described in `reference/stack-guide.md`).
- The person's instructions you will record as overrides, and what each one changes in the setup.
- **One permission request for the whole setup:** to create and edit those files, to merge the guard into the tool settings listed, and to run the setup commands (copying files, `git config`, the self-tests). Say how to grant it in this tool so it does not stop at every file:
  - Claude Code: choose "allow all edits" when it first asks, or press Shift+Tab to turn on auto-accept edits. Edits to `.claude/settings.json` may still ask once.
  - Codex: type `/approvals` and choose the mode that lets it edit files and run commands in this folder.
  - Cursor, Gemini CLI, OpenCode, Antigravity: turn on auto-accept for file edits for this session.
  It covers this folder only. Never ask for access outside it, except Codex commands in the person's home folder (Step 5), which need their own yes.

Wait for a clear yes before writing anything. Then create everything in one go, in the order of Steps 4 to 6, without asking again for each file.

## Step 4. Write the map, the rules and the working documents

Copy each template, replace every `{{...}}` with real content, and **delete any part that does not apply** rather than leaving a placeholder behind.

| Create | From | What it is for |
| --- | --- | --- |
| `AGENTS.md` | `templates/AGENTS.md` | The short map every agent reads first |
| `docs/rules/workflow.md` | `templates/docs/rules/workflow.md` | Phases, items, the work loop, ready and done, dependencies, blocked and deadlocked work, handoffs |
| `docs/rules/parallel.md` | `templates/docs/rules/parallel.md` | Modes, the board, the coordinator and builders, worktrees, the merge sequence |
| `docs/rules/testing.md` | `templates/docs/rules/testing.md` | When to run which checks, what every item must test, the coverage floor |
| `docs/rules/docs.md` | `templates/docs/rules/docs.md` | Which docs agents keep current and when, generated docs, writing for the operator |
| `docs/rules/git.md` | `templates/docs/rules/git.md` | Commits, merges and deploys |
| `docs/rules/review.md` | `templates/docs/rules/review.md` | The review of every item, and the phase-end adversarial review, cleanup and retro |
| `docs/rules/bugs.md` | `templates/docs/rules/bugs.md` | Getting a clear report, finding the cause, fixing it with a test |
| `docs/words.md` | `templates/docs/words.md` | One name for each thing, plus plain meanings of technical words |
| `docs/operator/launch.md` | `templates/docs/operator/launch.md` | Before going live: money limits, legal basics, domain and email, phones and accessibility, after launch |
| `docs/operator/todo.md` | `templates/docs/operator/todo.md` | The operator's to-do list: installs, sign-ups, keys, payments |
| `docs/operator/mtest.md` | `templates/docs/operator/mtest.md` | Checks only a human can do, with IDs |
| `docs/operator/guide.md` | `templates/docs/operator/guide.md` | How to run and look after the project, in plain words |
| `docs/operator/run.md` | `templates/docs/operator/run.md` | The run card: the commands to start, stop, test and build it, on one page |
| `docs/architecture.md` | `templates/docs/architecture.md` | How the parts fit together |
| `docs/changelog.md` | `templates/docs/changelog.md` | What changed for users, in plain words |
| `docs/build/README.md` | `templates/docs/build/README.md` | The roadmap and the current phase |
| `docs/build/backlog.md` | `templates/docs/build/backlog.md` | Everything wanted but not yet planned into a phase |
| `docs/build/decisions.md` | `templates/docs/build/decisions.md` | Every decision, so nobody undoes one by accident |
| `docs/build/templates/` | `templates/docs/build/templates/` | Phase plan, phase review and handoff templates, copied as they are |
| `docs/stack.md` | `templates/docs/stack.md` | The tech stack and why |
| `docs/learning.md` | `templates/docs/learning.md` | Known problems and their fixes |
| `docs/security.md` | `templates/docs/security.md` | Security rules and this app's go-live checklist |
| `.env.example` | `templates/env.example` | Variable names only. If one exists, keep it and add the header |
| `.gitignore` | `templates/gitignore.txt` | Append only the lines that are missing |

**Keep `AGENTS.md` short:** under 100 lines once filled in. It is loaded into every session of every tool, and a long rulebook makes agents worse. Anything not needed in every session goes into the right file in `docs/rules/`, with a row in the "Load only when you need it" table if it is a new file.

**Filling in `AGENTS.md`:**

- **Operator overrides:** every standing instruction the person gave, dated. If there are none, write "- None yet."
- **Commands:** this project's real commands, smallest check first. If there are no tests yet, say what the smallest proof is, and make "set up tests" the first item in phase 1.
- **Never list:** keep the defaults, add the person's answer about what agents must never touch, and add stack-specific items. Examples: a Supabase service role key or Firebase Admin SDK in client code; a Stripe secret key in the frontend.
- **Mode:** one agent, taking turns, or parallel, from their answer.
- **Map:** the real code folders, from the Layout in `docs/stack.md`. Never plan code into `docs/`.
- **Rules found in `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md` or similar:** move each one to the right place: `AGENTS.md` if every session needs it, otherwise the matching file in `docs/rules/`. Leave those files pointing at `AGENTS.md`, and show the person exactly which rules moved where. If they want to keep a tool file as it is, respect that.

**Filling in `docs/rules/`:**

- `testing.md`: the coverage command for this stack and the floor (default 70% of lines, set in the test config), the before-commit row from their answers and overrides, and any invariants.
- `git.md`: the deploy rule from their answer about shipping (or that nothing is deployed), and how branches work if they use them.
- `git.md`: save points stay on unless the person turned them off; then write the override in its blank.
- `parallel.md`: the mode, and how merges are approved (default: the operator says "merge" for each batch). Copy `tool-configs/board.json` to `.agents/board.json` and fill it in: the main branch, `checks` (the item-done commands from Commands, which `merge` runs before and after each merge), the number of builders at once (default 3), and `worktreeDir` only if the default sibling folder (`../<project>-worktrees`) won't work. A sibling folder keeps test runners in the main checkout from picking up builders' files; use `.worktrees` inside the project only if the tools cannot work outside it.
- Wherever an override contradicts a default, reword the default to match.

**Filling in the operator's folder and the project docs:**

- `docs/operator/todo.md`: one `op-` entry for everything the person must do before or during phase 1: tools missing from this computer (from Step 1), every account the stack needs, a spending limit and billing alert for every paid one, every API key (named in `.env.example`, entered with `node .agents/scripts/keys.mjs add <NAME>`), a first save point if parallel mode needs one. Exact steps in plain words, most urgent first.
- `docs/words.md`: the project's own nouns from the idea (the people, the things they make or manage), one name each, plus any technical words you will use with them.
- `docs/operator/run.md`, the run card: the real commands, from what Step 1 found. In a project without code yet, fill in what the stack already tells you, and in each row that needs code write `Not ready yet (<id> sets it up)`, naming the phase 1 item that makes it run. That item fills the row in before it counts as done, and the health check flags a row still waiting on a finished item. Once the commands work, if the person uses VS Code or Cursor, offer to add the same commands as tasks in `.vscode/tasks.json`, so they can run them from Terminal, Run Task, without typing.
- `docs/operator/launch.md`: copy it, fill in the project name, and delete the sections that clearly don't apply (for example payments, if there are none), saying why.
- `docs/operator/guide.md`: fill in what is known now (what it is, where it will live, accounts and costs). Keep the plain-words model guidance: start with the current settings for small, clear tasks, explain a recommended change when the work calls for it, and give exact tool-specific steps only from verified options. Follow Models and thinking settings in `docs/rules/workflow.md`; the skill does not itself switch the active model. Mark the rest "filled in by phase 1", and make keeping it current part of the phase 1 items that set those things up.
- `docs/architecture.md`: the planned parts from the stack, or the real parts for an existing project.
- `docs/changelog.md`: copy as it is.

**Pointing each tool at `AGENTS.md`:**

- Claude Code: `CLAUDE.md` from `templates/CLAUDE.md` (its `@AGENTS.md` line imports the map). If `CLAUDE.md` exists, add the `@AGENTS.md` line at the top and move its rules out as described above.
- Gemini CLI or Antigravity: they read `AGENTS.md`. If a `GEMINI.md` exists, add `@AGENTS.md` at its top, or use `templates/GEMINI.md`.
- Codex, Cursor, OpenCode, Copilot and Windsurf read `AGENTS.md` on their own.

## Step 5. Install the guards and the board

Copy `guards/guard.mjs` and `guards/precommit-guard.mjs` to `.agents/hooks/` in the project, and `scripts/board.mjs`, `scripts/keys.mjs`, `scripts/health.mjs`, `scripts/commands.mjs`, `scripts/codex-guard.mjs` and `scripts/update.mjs` to `.agents/scripts/`. If the person asked for no hooks, skip what they ruled out, record it as an override, and say in one sentence what it leaves open.

**Keep the skill in the project**, so `/ar-setup` and later updates work without downloading again: copy this whole skill folder (the one this file is in) to `.agents/skills/agent-ready/`, unless it is already there. If you were started from the paste-in prompt, delete `.agent-ready-download` once everything is copied.

**Install the commands.** Copy `commands/` to `.agents/commands/`, then run `node .agents/scripts/commands.mjs install --tools <the tools in use>` (any of `claude`, `cursor`, `gemini`, `opencode`). It writes `/ar-help`, `/ar-status` and the rest into each tool's own command folder, and the list for the person into `docs/operator/commands.md`. Codex keeps commands in the person's home folder, not the project: if they use Codex, ask before adding `--codex` (they then type `/prompts:ar-help`). Antigravity and any other tool: the person types the name without the slash, like "ar-status", and `AGENTS.md` tells the agent where to find it.

**Record the version.** Once the files above and the skill copy are in place, run `node .agents/scripts/update.mjs --record`. It saves the version and a fingerprint of each of agent-ready's own files in `.agents/agent-ready.json`, so `/ar-update` can later tell them apart from changes made here.

**Wire `guard.mjs` into every tool in use.** Merge, never replace, existing settings and hooks:

| Tool | Do this | Then tell the person |
| --- | --- | --- |
| Claude Code | Merge `tool-configs/claude-settings.json` into `.claude/settings.json` (the shared, committed file) | Restart Claude Code |
| Codex | Merge `tool-configs/codex-config.toml` into `.codex/config.toml` | Switch it on once (Step 6). Until then Codex skips it silently |
| Cursor | Merge `tool-configs/cursor-hooks.json` into `.cursor/hooks.json` | Restart Cursor |
| OpenCode | Copy `tool-configs/opencode-plugin.js` to `.opencode/plugins/agent-ready-guard.js` | Restart OpenCode |
| Gemini CLI or Antigravity | Merge `tool-configs/gemini-settings.json` into `.gemini/settings.json` | Hook support differs between versions; check with `/hooks` |
| Anything else | No hook support known | The rules in `AGENTS.md` and the git check below still apply |

The commands are plain `node ...` lines that work in PowerShell, cmd, Git Bash, macOS and Linux. Keep them as they are.

**Wire `precommit-guard.mjs` into git**, so secrets cannot be committed by anyone:

- **husky:** add `node .agents/hooks/precommit-guard.mjs` to `.husky/pre-commit`.
- **lefthook or the pre-commit framework:** add a local hook that runs the same command.
- **No hooks yet:** copy `guards/git-pre-commit` to `.githooks/pre-commit`, add the line `.githooks/* text eol=lf` to `.gitattributes` (Windows line endings stop the hook from running), then run `git config core.hooksPath .githooks`. On macOS or Linux also run `chmod +x .githooks/pre-commit` and `git update-index --chmod=+x .githooks/pre-commit`. In a Node project, add `"prepare": "git config core.hooksPath .githooks"` to `package.json` scripts so fresh clones get the hook too. If `core.hooksPath` is already set to something else, ask first.

## Step 6. Prove the guards work

Tell the person first, in one line: *"One check below should be blocked. If your tool shows it in red as failed or blocked, that is the protection working."*

1. Run `node .agents/hooks/guard.mjs --self-test` and `node .agents/hooks/precommit-guard.mjs --self-test`. Every line must say PASS. Run `node .agents/scripts/board.mjs check`; it must pass (after Step 8 too, once the phase 1 plan exists).
2. **Prove the hook is wired into the tool you are running in.** Create `.env.agent-ready-check` containing `AGENT_READY_CHECK=this-is-not-a-secret` with your file-writing tool (the guard allows this one file). Then try to read it with your normal file-reading tool.
   - **Blocked:** the guard works here. Delete the file with your file tool or one plain command (`rm .env.agent-ready-check`, or `Remove-Item .env.agent-ready-check` in PowerShell). Keep that command on its own: wrapped in another command, a variable or an `if`, the guard blocks it too.
   - **You could read it:** nothing leaked, it was only a decoy. Many tools load hooks only when they start, so this is expected straight after setup. Leave the decoy in place, ask the person to restart the tool, then run the test line in step 3 in the fresh session. If it still is not blocked, the wiring is wrong: check the path in the config and that `node` runs from the project folder.
3. For every other tool in use, give the person this one line to paste there after restarting it: *"Create .env.agent-ready-check containing AGENT_READY_CHECK=1, then try to read it and tell me whether you were blocked."*
4. **Codex:** it runs the guard only after the person reviews and trusts it, once. Tell them: *"Open this project in the Codex app. When it shows a hook-approval icon in its bar, open it, check the command is `node .agents/hooks/guard.mjs`, and approve it. Typing `/hooks` in the app's chat won't work: that only works in Codex's terminal version."* If they don't see the icon (an older version, or the editor extension), offer the fallback: with their yes, run `node .agents/scripts/codex-guard.mjs`. It opens a window with Codex already running in the project and prints the four steps (trust the folder, `/hooks`, pick the agent-ready guard and choose Trust, `/quit`), or what to do if it can't. Never trust the hook for them, and never bypass the trust check.
5. If this is a git repo, run `node .agents/hooks/precommit-guard.mjs --decoy-test`. It must print PASS. It stages a made-up secret file in a throwaway copy of git's staging area, so nothing real is staged and no file is left behind.
6. Run `node .agents/scripts/keys.mjs` to see which keys are still missing (names only), and `node .agents/scripts/health.mjs` (again after Step 8). Fix every FIX line. A LOOK line the person can settle right now, such as a restart or switching on the guard in Codex, goes in your report as a step for now. Only work they will do later, outside the chat, goes on their to-do list.

## Step 7. Check for secrets that already leaked (existing projects)

1. Run `node .agents/hooks/precommit-guard.mjs --scan-repo`. It checks tracked files for secret files and real-looking keys and masks what it finds.
2. If a secret file is tracked, or a key is found, **stop and tell the person in plain words**: anyone with access to the repo can see it, and git keeps old copies, so deleting it is not enough. Every key involved must be replaced with a new one in the provider's dashboard (the person does this), and the file untracked with `git rm --cached <file>`. Do not try to rewrite git history yourself.
3. If `gitleaks` is installed, offer to run `gitleaks detect` for a deeper scan of the whole history. Do not install it without asking.

## Step 8. Plan the work before any code

**New project:** turn the idea into a plan, following `docs/rules/workflow.md` as you just wrote it.

1. Write `docs/product.md` from `templates/docs/product.md`: one sentence, the problem, who it is for, what version 1 must do, what waits, and how you will know it works. If the idea is thin, shape it first, as "Shaping" in `docs/rules/workflow.md` says: one round of plain-words questions with suggested answers. Then write the phase 1 brief (`docs/build/phases/phase-1-<name>/brief.md` from `docs/build/templates/feature-brief.md`) from their answers.
2. Write `docs/stack.md` from `templates/docs/stack.md` with the approved stack and its layout.
3. **Roadmap:** in `docs/build/README.md`, list the phases. Phase 1 is a walking skeleton: the project skeleton in the folders the layout names, tests (and CI on every push, if the code is on GitHub), **a first release of a nearly empty app, shipped the way the real one will be** (deployed, published, or run from a fresh copy if nothing is hosted) so shipping works before features exist, then the thinnest end-to-end slice of the core feature. Each later phase delivers one more thing the operator can try. Later phases get one line each (the goal only).
4. **Phase 1 plan:** copy `docs/build/templates/phase-plan.md` to `docs/build/phases/phase-1-<name>/plan.md` and fill it in. Write stories as thin vertical slices, size S or M, each with Given/When/Then acceptance checks, a Tests line, Depends, and Touches in backticks (real paths from the layout, as specific as you can, because the board uses them to keep parallel agents apart). Group items into iterations so that items in the same iteration never depend on each other. Anything the operator must do later, outside the chat (sign-ups, keys, payments, installs), goes in `docs/operator/todo.md` as an `op-` item in the format `docs/rules/docs.md` gives, and the items that need it list its ID in `Depends`. Approving the plan is not an entry: you ask for it in the chat.
5. Everything from version 1 that is not in phase 1 goes into a later phase line or `docs/build/backlog.md`. Everything under "Not now" goes into the backlog's Later or Ideas section.
6. Run `node .agents/scripts/board.mjs check` and fix anything it finds. Run `node .agents/scripts/board.mjs graph` so the person can see the plan as a picture in `docs/build/graph.md`.
7. **Stop.** Ask the person to read `docs/product.md`, `docs/stack.md`, the phase 1 plan and their to-do list, and say yes before anything is built. Log their answers in `docs/build/decisions.md`.

**Existing project:** don't invent a plan. Fill in `docs/stack.md` and `docs/architecture.md` from the repo, set "Current phase" in `docs/build/README.md` to "none yet", and offer to turn their to-do list, open issues or next feature into a backlog and a first phase plan. If code or build output sits in `docs/`, point it out and offer to move it (with a list, and their yes).

## Step 9. Report back

Keep it short and plain:

- **What is set up:** one line per group (the map, the rules, the roadmap and phase plan, the backlog, decisions, words, the operator's folder, handoffs, known problems, the board, the guards, the key helper, the health check, the git check).
- **Health:** the last line of `health.mjs`, and anything still to fix.
- **Your to-do list:** how many entries `docs/operator/todo.md` has, and the first one to do.
- **Your commands:** "Type `/ar-help` any time to see them all." Name the ones they will use most: `/ar-status`, `/ar-next`, `/ar-run`, `/ar-test`, `/ar-todo`, `/ar-bug`, `/ar-undo`. Later, `/ar-update` brings in a newer agent-ready.
- **Run it yourself:** `docs/operator/run.md` has the commands to start, stop, test and build it, on one page (rows that need code say which item fills them in).
- **Overrides recorded:** each one, and what it changed.
- **What the guards block:** reading or writing secret files, dumping environment variables, force push, hard reset, `git clean`, mass deletes, dropping tables, resetting a remote database, running downloaded scripts directly, skipping git hooks.
- **What they do not do:** they are a seatbelt, not a vault. They catch the normal ways an agent reads a file, not every possible trick. Production keys belong in the host's secret settings.
- **What to do now, in this chat:** restart the tool, approve the guard in Codex (the hook-approval icon in the Codex app's bar), paste the test line in other tools, and say yes to the phase 1 plan. These are steps for now, not entries on the to-do list. Replacing a leaked key is the exception: it goes on the list.
- **How to work from now on:**
  - Agents read `AGENTS.md` at the start of every session and load the rest only when needed. Most tools do this on their own.
  - Work moves phase by phase. `docs/build/README.md` always shows where things stand.
  - At the end of each phase, the agent suggests an adversarial review of the whole codebase and a cleanup. Say yes, or skip it.
  - Tell an agent "from now on..." and it becomes an override in `AGENTS.md` that every agent follows.
  - Every finished item is saved as a save point you can go back to ("undo auth-003"). Nothing leaves your computer until you say so: the word they chose for shipping (for example **deploy**).
  - Before a new phase or a big feature, the agent asks you a few plain questions and writes a short brief for your yes. Every item is reviewed before it is saved.
  - Add keys yourself with `node .agents/scripts/keys.mjs add <NAME>`. It hides what you type and keeps the key out of the chat.
  - Something broken? Report it the way `docs/operator/guide.md` shows. Going live? Work through `docs/operator/launch.md` with an agent.
  - `docs/operator/` is yours: `todo.md` is what agents need from you (say "op-003 done" when you finish one, and never paste a key into the chat), `mtest.md` is the checks only you can do (report them by ID, like "MTEST-AUTH-001 passed"), and `guide.md` explains how to run everything in plain words.
  - Parallel mode only: in one session, type `/ar-coordinate`. It hands items to builders, each in its own worktree, and asks you before merging.
  - Before you close a session partway through, ask for a handoff note.
  - When the same problem bites twice, ask the agent to add it to `docs/learning.md`.
  - When an agent makes a call on its own, it is in `docs/build/decisions.md`. Skim it now and then.

## Running this skill again

**Already set up, and this is a newer agent-ready?** Update instead of setting up again. Run `node .agents/scripts/update.mjs` in the project, or, from a fresh download, `node .agent-ready-download/skills/agent-ready/scripts/update.mjs --from .agent-ready-download`, and follow the steps in `commands/ar-update.md`. It replaces only agent-ready's own files, keeps any changed here, and never replaces a document: an agent offers the document changes one at a time. Delete `.agent-ready-download` afterwards.

If the project is already set up, run `node .agents/scripts/health.mjs` first: it shows what is missing or broken. Then compare with these templates and add only what is missing. Never reset or shorten existing documents, and never remove rules or overrides the person added.

**Set up by an older version of agent-ready?** Signs: a long `AGENTS.md` with numbered sections 1 to 12, task files like `docs/build/phase-1.md`, `docs/build/handoff-template.md`, or `MTEST.md` in the project root. Offer to move it to this layout. Keep every rule, item, check and ID: move detailed sections out of `AGENTS.md` into `docs/rules/`, task files into `docs/build/phases/<phase>/plan.md`, templates into `docs/build/templates/`, `MTEST.md` to `docs/operator/mtest.md`, and "Operator tasks" sections into `docs/operator/todo.md` as `op-` items. Then add the board and run `board.mjs check`. Show the person every move and wait for a yes.
