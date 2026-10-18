# Fixing problems

Load this when something is broken: the operator reports a problem, a check fails on code that used to work, or you notice the app doing the wrong thing. A command or tool failing on you is different: look in `docs/learning.md` first. The operator overrides in `AGENTS.md` beat anything here.

## 1. Get a clear report

If the operator reported it, make sure you have, in their words:

- **What they did:** the steps, starting from somewhere you can reach (a page address, a button).
- **What they expected,** and **what happened instead.**
- **Where:** their device and browser, and whether it was live or on their computer.
- **When it started,** if they know: "after yesterday's deploy" narrows it down a lot.
- **A screenshot or the exact error text.** Never ask for keys, passwords or customer data, and if they send some, tell them to replace that key.

Ask only for what is missing, in one message. The report format the operator sees is in `docs/operator/guide.md`.

## 2. Log it

Add a `bug-NNN` item in the item format from `docs/rules/workflow.md`, with the report as its first lines.

- **It stops people using the app, loses data, takes money wrongly or leaks anything:** it goes at the top of the current phase. Tell the operator straight away, in plain words, and say whether going back to an earlier save point (`docs/rules/git.md`) would stop the harm while you fix it.
- **Anything else:** the backlog, ordered by how many people it hurts.

## 3. Find the cause before you change anything

1. **Make it happen yourself.** Follow the steps. If you cannot make it happen, say so and ask for the missing detail. Don't guess-fix.
2. **Write a failing test** that shows the problem. It fails now and must pass once fixed.
3. **Narrow it down.** Read the error and the code path it points to. Check what changed recently: `git log --oneline -- <file>` and the save points since it last worked. If it worked at one save point and not at a later one, check the save points in between to find the one that broke it.
4. **Name the cause** in one sentence before you fix it: what is wrong, and why it shows up that way. If you can't, you haven't found it yet.

## 4. Fix the cause, not the symptom

- Change as little as you can. Don't rewrite the area while you are in there; add a chore to the backlog instead.
- Never hide it: no catching an error just to silence it, no skipping or loosening a test, no special case for the one input from the report.
- The new test passes, and so does the full suite.

## 5. Close it

- Item review (`docs/rules/review.md`), then a save point.
- The Done line says the cause and the fix in one plain sentence each.
- If it could happen again elsewhere, add a line to `docs/learning.md`, and if a test can stop it for good, list it under Invariants in `docs/rules/testing.md`.
- Tell the operator what was wrong and what changed, in plain words. If it was live, say whether it needs a deploy to reach users, and add a line to `docs/changelog.md`.
