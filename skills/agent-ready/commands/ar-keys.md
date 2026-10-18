---
description: Which keys are set or missing (names only, never values), and how to add one safely.
---
Show which keys the project needs and which are set, without ever showing a value.

1. Run `node .agents/scripts/keys.mjs` and explain the result in plain words.
2. For each missing key: say what it is for and where to get it (point to its entry in `docs/operator/todo.md`, or add one), and that they add it themselves, in their own terminal, with `node .agents/scripts/keys.mjs add <NAME>`. It shows stars instead of the key.
3. Never ask for a key in the chat, never read `.env`, and never run `keys.mjs add` yourself. If they paste a key into the chat anyway, tell them to replace it with a new one from the provider.
