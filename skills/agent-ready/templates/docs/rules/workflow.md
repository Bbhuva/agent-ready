# How work flows

Load this when you plan, claim, split, block on or finish an item. Several agents at once? Also read `docs/rules/parallel.md`. The operator overrides in `AGENTS.md` beat anything here.

## The shape of the work

- **Phases are releases.** Each one ends with something the operator can try, not a pile of half-finished layers. Phase 1 is always a walking skeleton: the project runs, tests run (on every push, if the code is on GitHub), a nearly empty app ships the way the real one will (deployed, published, or run from a fresh copy if nothing is hosted), and one thin slice of the core feature works end to end.
- **Items are the work inside a phase.** Most are stories: a thin slice through every layer (screen, logic, data) that a user would notice. Each one fits in one working session.
- **The backlog** (`docs/build/backlog.md`) holds everything not yet planned into a phase, most important first. New ideas go there, not into the current phase, unless the operator says now.
- **Plan one phase at a time.** Later phases stay one line each in `docs/build/README.md` until their turn, because what you learn now will change them.
- **The operator's part** (installs, sign-ups, keys, payments) lives in `docs/operator/todo.md` as `op-` items. Items that need one list it in `Depends`.

```text
docs/build/
  README.md                 roadmap: every phase, its goal and its status
  backlog.md                wanted, not yet planned into a phase
  decisions.md              every decision and why
  graph.md                  made by the board: dependencies and who touches what
  phases/phase-1-<name>/
    brief.md                what the operator wants, in their words (see Shaping)
    plan.md                 goal, exit criteria, iterations and items
    review.md               phase-end review, cleanup and retro
  handoffs/                 notes for whoever picks the work up next
  templates/                copy these, do not edit them
```

## Shaping: agree on it before you plan it

Before you plan a new phase, or any feature bigger than one item, talk it through with the operator so you build what they mean, not what you guessed.

1. **Read first.** `docs/product.md`, `docs/words.md`, the backlog, and the code the feature touches. Don't ask what the docs already answer.
2. **Ask once, in one message, in plain words.** At most seven questions, each with your suggested answer, so "go with your suggestions" is a full reply. Cover: what problem this solves and for whom; what they will see and do, step by step; one real example; what happens when it goes wrong (no internet, wrong input, empty list); what is left out on purpose; how they will know it works.
3. **Play it back.** Copy `docs/build/templates/feature-brief.md` into the phase folder as `brief.md` and fill it in from their answers, in their words. New terms go in `docs/words.md`.
4. **Wait for a yes** on the brief before writing the plan. Then every item in the plan traces back to a line in the brief.

Skip shaping only for small fixes, or when the operator says to.

## Writing an item

```markdown
- [ ] **auth-003** Sign in with an email code `story · M · Must`
  - **Story:** As a returning user, I want to sign in with a code sent to my email, so that I don't need a password.
  - **Depends:** auth-001, op-002
  - **Touches:** `src/app/(auth)/`, `src/lib/auth.ts`
  - **Acceptance:**
    - Given a registered email, when I ask for a code, then an email with a 6-digit code arrives.
    - Given three wrong codes, when I try a fourth, then sign-in is locked for 10 minutes.
  - **Tests:** unit for code expiry, integration for the lock, end to end for the happy path.
  - **Notes:** magic links are out of scope.
```

- **Type:** `story` (a user notices it), `task` (groundwork a story needs), `bug`, `spike` (research with a time limit; its output is a decision, not code), `chore` (upkeep).
- **Size:** `S` (a few files), `M` (one session), `L` (too big: split it before anyone starts).
- **Priority:** `Must`, `Should` or `Could` for this phase. The order in the file is the order of work.
- **IDs never change and are never reused.** A short lowercase prefix per area (`auth-`, `ui-`, `api-`, `ops-`; `op-` is the operator's), numbered upwards. Commits, manual checks, decisions and handoffs refer to them.
- **Touches** lists the files or folders the item will change, in backticks. The board uses it to stop two agents working on the same files, so be honest and specific.
- A good item is independent, small, testable and worth something to someone. If you can't write its acceptance checks, it is not ready: make it a spike, or ask.

| Mark | Meaning |
| --- | --- |
| `[ ]` | To do |
| `[~]` | In progress, with `**Claimed:** <agent or tool>, <date and time>` |
| `[!]` | Blocked, with `**Blocked:** <by what or whom>` |
| `[x]` | Done, with `**Done:** <date>. What changed, where the tests are, the commit if any.` |
| `[-]` | Dropped, with the reason |

## Ready: when an item can be started

- Its acceptance checks and `Tests` line are written, and `Touches` lists what it will change.
- Every item in `Depends` is `[x]`, including `op-` items, or an agreed contract stands in for it (see Dependencies).
- It is size S or M, and no operator question is open on it.
- Nobody is working on files it touches.

`node .agents/scripts/board.mjs ready` lists exactly the items that pass the checks it can make.

## The loop

1. **Pick** the first item `board.mjs ready` lists.
2. **Claim** it: `node .agents/scripts/board.mjs claim <id> --agent <your name>`, then mark it `[~]` with the `**Claimed:**` line. If the board lists **paused** work, pick that up first with `resume` (see below) rather than starting something new. One claim per agent at a time. (In parallel mode the coordinator does both.)
3. **Plan** in 3 to 8 bullets: what changes, which files, any new dependency and why. If you will touch files outside `Touches`, release, update `Touches`, and claim again.
4. **Build** in small steps, following the patterns already in the repo. Code goes where the Map in `AGENTS.md` says, never in `docs/`. Name things with the words in `docs/words.md`. Don't tidy code outside the item; add a chore to the backlog instead.
5. **Check** it as `docs/rules/testing.md` says.
6. **Review** your own change with fresh eyes, as "Item review" in `docs/rules/review.md` says, and fix what it finds.
7. **Finish** it against the definition of done, tick it, make the save point (`docs/rules/git.md`), then `board.mjs release <id>`.

## Done: when an item can be ticked

- Every acceptance check passes, and you ran it yourself.
- The tests `docs/rules/testing.md` asks for are written and pass. Lint and type checks are clean, with no new warnings.
- The item review in `docs/rules/review.md` found nothing left to fix.
- No debug output, commented-out code, or TODO without an item ID is left behind.
- The docs it affects are updated, as `docs/rules/docs.md` says. If it adds or changes a command the operator uses (start, test, build, install), the run card `docs/operator/run.md` says so, and a row waiting on this item (`Not ready yet (<id> sets it up)`) is filled in.
- Checks only a human can do are in `docs/operator/mtest.md`, linked to the item ID.
- Decisions you made alone are in `docs/build/decisions.md`. New gotchas are in `docs/learning.md`.
- The item has its `**Done:**` line, it is saved as a save point, its claim is released, and the phase status in `docs/build/README.md` is updated.

## Dependencies

- `Depends` lists item IDs, never vague words. An item may depend only on items in the same or an earlier phase, and on `op-` items.
- **No cycles.** If A needs B and B needs A, the shared piece is its own item: pull it out, make both depend on it, and log the split in `docs/build/decisions.md`.
- **Iterations follow the order of dependencies.** An item may depend on items in earlier iterations, never on items in its own. So everything in one iteration can be built in parallel.
- **Contracts unblock parallel work.** If B only needs the shape of A (an API, a type, a table), add a small item that writes the shape down (types, a schema, an API spec). A and B both depend on it, then run side by side.
- **Packages:** use what is already installed first. Every new package needs a reason in its item or in decisions. Commit the lockfile.
- `node .agents/scripts/board.mjs check` finds duplicate IDs, unknown and circular dependencies, and dependencies inside one iteration. Run it after every planning change.

## Blocked, stale and deadlocked work

- **Blocked?** Mark the item `[!]` with the `**Blocked:**` line, release it, and pick the next ready item. Never sit on a claim while you wait. A released `[~]` or `[!]` item shows on the board as **paused**: its partial work stays where it is and still holds its files.
- **Picking up paused work:** `node .agents/scripts/board.mjs resume <id> --agent <your name>`. Read its handoff first (the board names it). It keeps the item's ID, its branch or worktree and its partial work, and records you as the new holder. Resume your own claim the same way after a new session.
- **Waiting on the operator?** Add an `op-` entry to `docs/operator/todo.md` with exact steps, add its ID to the item's `Depends`, and carry on with something else.
- **No ready item left?** Stop. Write a handoff listing what is blocked and on whom, and tell the operator.
- **Stale claims:** the board flags a claim with no progress for more than a day. Look at the work, write a handoff if there is none, then take it over with `resume <id> --agent <your name> --take-over`. A fresh claim by someone else is never taken: `resume` refuses it. Ask the operator or the other agent; only they should release it.
- **No deadlocks:** hold one claim at a time, and never wait while holding it. If two agents still need each other's items, both release, and the item with the lower ID goes first.
- **Shared checkout:** stage only the files you changed. Never revert, reformat or delete another agent's work in progress.

## Sessions and cost

Long chats cost more and make agents worse: old detail crowds out what matters now.

- **One item per session.** When an item is done and saved, start a fresh session for the next one. Everything it needs is in the files.
- **Write a handoff before you stop** partway, so the next session starts from the note instead of the whole chat.
- **Point to files, don't paste them.** Give a path and the lines that matter, not a whole log or file in the chat.
- **Read only what the task needs.** Search first, then open the part you need (the table in `AGENTS.md` says which doc for which job).
- **Match the model to the work.** Use the guidance below; the operator should not need to learn model names or reasoning labels before starting.
- If a session drags on or keeps going in circles, stop, write a handoff, and tell the operator to start fresh.

## Models and thinking settings

- **Start with what the person has.** For a small, clear, low-risk item, start with the current model and settings. Keep the item bounded and check the result. Do not promise that every model can complete every task.
- **Recommend a change when it matters.** For unclear requirements, architecture, changes involving sign-in, permissions, payments or data loss, difficult debugging, or an important review, consider a more capable available model or more reasoning. Explain the reason in one sentence. First check whether missing information or an unclear task is the real problem. Repeated failure on a clear task is another reason to reconsider the model, rather than repeat the same attempt.
- **Use the options actually available.** Check the tool's visible model list, configuration or current official documentation; do not invent a model name, price or supported setting. If you cannot see the options, say so and ask for the names shown in the picker only when a change would help. Respect the person's budget and explicit model choice.
- **Explain the labels only when needed.** A model is the AI doing the work. A reasoning setting controls how much effort a supported model spends working through it. Labels such as high or xhigh are tool-specific; more effort can take longer and use more allowance. Do not make the highest setting the default for everything.
- **Be honest about switching.** These files guide the agent; they do not themselves switch the active model. Change a setting only through a supported control, within the person's authorisation, and verify it took effect. If you cannot change it, give the person the exact short step for their tool and write a handoff when a fresh session is needed. Never claim a switch happened just because you recommended one.
- **Record and verify.** Log an agreed standing preference in the operator overrides, with task-specific choices in decisions or the handoff. Keep the same acceptance checks when using a lighter model. Call cost or quality improvements measured only after comparing results.

## Changes of plan

- **The operator asks for something new mid-phase:** add it to the backlog and ask whether it goes into this phase. If it does, say what it pushes out.
- **You find a problem outside your item:** add a bug or chore to the backlog. Don't fix it on the side. Something is actually broken? Follow `docs/rules/bugs.md`.
- **Re-plan at phase boundaries,** not in the middle of an item.

## Handoffs

When you stop partway, finish a batch, or the operator asks: copy `docs/build/templates/handoff.md` to `docs/build/handoffs/<date>-<topic>.md` (or `<id>.md` for one item) and fill it in, naming the item IDs. Then release your claims, leaving the items marked `[~]`, so the next agent can pick them up with `resume`. Once the work it describes is done, move the note to `docs/archive/`.

## End of a phase

When the last Must item is `[x]`:

1. Tell the operator the phase is done, what they can now try, and which entries in `docs/operator/mtest.md` are theirs to run.
2. Suggest the phase-end review and cleanup in `docs/rules/review.md`.
3. Don't start the next phase until the operator says go, or says to skip the review. Then shape the next phase with the operator, plan it from the brief and the backlog, run `board.mjs check`, and ask the operator to approve the plan before building.
