# Run it yourself

Everything you type to use {{PROJECT_NAME}} on your own computer, on one page. Open a terminal in the project folder, type the command, and press Enter. Rather not type? Ask an agent: `/ar-run` starts it for you, and `/ar-test` runs the checks.

| You want to | Type this | You'll see |
| --- | --- | --- |
| Start it | {{the start command, e.g. `npm run dev`}} | {{what appears when it is ready, e.g. "Ready on http://localhost:3000"}} |
| Open it | {{the address, e.g. http://localhost:3000}} | {{e.g. the home page}} |
| Stop it | Press Ctrl+C in that terminal | The prompt comes back |
| Run the tests | {{e.g. `npm test`}} | {{e.g. "12 passed"}} |
| Build it | {{e.g. `npm run build`, or delete this row if there is nothing to build}} | {{e.g. "Compiled successfully"}} |
| After getting new changes | {{the install command, e.g. `npm install`}} | {{e.g. "added 3 packages"}} |
| Check the setup | `node .agents/scripts/health.mjs` | A list of OK and LOOK lines |

**Something didn't work?** Copy the last few lines from the terminal, type `/ar-bug`, and paste them after it.

{{FIRST_TIME: on a fresh computer, what to install first, pointing to its entry in docs/operator/todo.md; or delete this line.}}
