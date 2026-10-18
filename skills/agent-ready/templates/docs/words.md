# Words we use

One name for each thing, used everywhere: in chat, in the docs, and in the code (file names, functions, tables). When the operator, the docs and the code all call it the same thing, nobody builds the wrong thing by accident.

Agents: use these names when you write code and talk to the operator. When a new thing appears, add it here in the same item. If you notice two names for one thing, pick one with the operator, log it in `docs/build/decisions.md`, and add a chore to rename the other.

## Things in this project

| Word | What it means here | Don't call it |
| --- | --- | --- |
| {{e.g. Member}} | {{A person who belongs to a club and pays dues}} | {{user, player, customer}} |

## Technical words you'll hear

Plain meanings for words agents use, so the operator can follow along.

- **Save point:** a saved copy of the project after a finished item, which you can go back to.
- **Deploy:** putting the latest version live.
- **Phase:** a stage of the build that ends with something you can try.
- **Item:** one piece of work in a phase, with an ID like `auth-003`.
- **Branch / worktree:** a separate copy where one agent works without getting in another's way.
- **Environment variable / key:** a setting or secret the app reads when it starts, kept in `.env`, never in the code.
- **Test:** a small program that checks the app does what it should, run automatically.
- {{More words agents use in this project, one line each.}}
