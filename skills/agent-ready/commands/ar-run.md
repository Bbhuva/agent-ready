---
description: Start the app on this computer and give you the link, with no commands to type.
argument-hint: "[which part, if there is more than one]"
---
Start the project for the operator, the way the run card `docs/operator/run.md` says. Their words: $ARGUMENTS

1. Read the run card. If the start row says "Not ready yet", tell them in plain words which item sets it up, and stop.
2. Run `node .agents/scripts/keys.mjs` (names only). If a key the app needs to start is missing, name it, point to its entry in `docs/operator/todo.md`, and stop.
3. If the run card says to install first and the packages aren't there yet (for example no `node_modules/`), run the install command from the card.
4. Run the start command so it keeps running in the background, if your tool can do that. Wait until it says it is ready, then give them the link to open. For a script or a command-line tool, run it and show what it printed instead.
5. Tell them how to stop it: ask you to stop it, or press Ctrl+C in its terminal.
6. If it fails, give the last few lines of the error in plain words and offer to look into it as a bug (`/ar-bug`). Don't change any code just to make it start, unless they say yes.
7. If the command you used is not on the run card, or is different there, fix the run card.
