# What's new in agent-ready

Newest first. `/ar-update` shows the entries between your version and the new one. Its tool files (the guards, the scripts and the commands) are updated for you. Your documents never are: each "For your documents" list below is what an agent offers to change in them, one edit at a time, for your yes.

## 1.0.2 (2026-11-13)

A quieter first save point on Windows.

- **No wall of line-ending warnings:** Git on Windows used to print an "LF will be replaced by CRLF" warning for every file the setup wrote, about 170 of them. Setup now adds a block marked as agent-ready's to `.gitattributes`, which keeps agent-ready's files in LF line endings, so only a few warnings are left. Your own files aren't listed and work as before, your own lines in `.gitattributes` are never changed, and `/ar-update` refreshes only agent-ready's block.
- **A heads-up before the first save point:** on Windows, the setup says first that any line-ending warnings left are harmless.

### For your documents

- `.gitattributes`: offer to add agent-ready's block by running `node .agents/scripts/update.mjs --gitattributes`. It lists only agent-ready's own files, and leaves your lines as they are.

## 1.0.1 (2026-11-03)

Two precautions for Codex's settings.

- **Setup edits only the project's Codex file:** it merges the guard into the project's own `.codex/config.toml`, and never edits Codex's settings in your home folder, which Codex manages itself.
- **One copy of Codex at a time:** when the guard is switched on from Codex's terminal version (`node .agents/scripts/codex-guard.mjs`), the steps now start with quitting the Codex app, so only one copy of Codex changes its settings at a time.

### For your documents

- Nothing to change.

## 1.0.0 (2026-10-22)

The first numbered version. Projects set up before it have no version yet, and get everything below.

- **Run it yourself:** a one-page run card, `docs/operator/run.md`, with the commands to start, stop, test and build. `/ar-run` starts it for you and gives you the link, and `/ar-test` runs the checks and answers in plain words.
- **Updates:** `/ar-update` moves a project to a newer agent-ready. It replaces agent-ready's own files, keeps any you changed, and never replaces your documents.
- **Shipping fits the project:** a host, an app store, a package, or nothing to deploy. No commit-message marker unless you ask for one.
- **The tech stack fits what you build:** it starts from where it runs and the languages you know, and suggests the database from what the data does. Tools that run only on your computer get a local setup with no host or cloud accounts.
- **A calmer first setup:** the commit check prints PASS instead of a red "failed", and setup steps are asked for in the chat instead of filling your to-do list.
- **Codex:** approve the guard from the hook-approval icon in the Codex app's bar. `node .agents/scripts/codex-guard.mjs` opens Codex's terminal version when there is no icon.
- **Parallel work recovers properly:** a merge that breaks main is undone and checked, the next merge brings all of that item's work back, paused work can be picked up with `resume`, and `undo` reverses an item's save points once each and can itself be reversed.

### For your documents

- `docs/operator/run.md`: new. Create it from the template, with this project's real commands.
- `docs/operator/guide.md`: "Run it on your computer" points to the run card; add `/ar-run` and `/ar-test` to the commands you use most; add "Using Codex? Switch on its safety guard once" if Codex is used here; "Save points: going back" says the undo shows what it will do first and can be reversed.
- `docs/operator/todo.md`: the "How agents write an entry" section moves out (see `docs/rules/docs.md`), so the file holds only the list.
- `docs/rules/docs.md`: add the run card row to the table; add the to-do entry format and the "Not on the list" paragraph to "The operator's to-do list".
- `docs/rules/workflow.md`: the definition of done keeps the run card true; picking up paused work with `resume`; "Match the model to the work" and "Models and thinking settings"; phase 1 ships the way the real app will.
- `docs/rules/git.md`: "Going back" uses `board.mjs undo` and its printed command to bring an item back; the deploy rule adds a commit-message marker only if you asked for one; one `-m` per paragraph for longer commit messages.
- `docs/rules/parallel.md`: the `resume` and `undo` commands; what happens when a merge breaks main; what the guard can and cannot see.
- `AGENTS.md`: the Map row for `docs/operator/` mentions the run card.
