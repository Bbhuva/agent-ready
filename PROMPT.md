# The paste-in prompt

Copy the box into your AI coding agent (Claude Code, Codex, Cursor, OpenCode, Gemini CLI or Antigravity), opened in your project folder. Replace the last line with your idea, or write "existing project".

```text
Set up this project with agent-ready: https://github.com/Bbhuva/agent-ready

1. Ask me once for permission to create and edit files in this folder and run the setup commands, for the whole setup.
2. Download it: git clone --depth 1 https://github.com/Bbhuva/agent-ready .agent-ready-download
   (No git? Download https://github.com/Bbhuva/agent-ready/archive/refs/heads/main.zip and unzip it into .agent-ready-download.)
3. Follow skills/agent-ready/SKILL.md from the download, step by step. It builds every folder and file.

My project: <your idea, or "existing project">
```

The setup looks around, asks you a few questions with suggested answers, shows you everything it will create, and waits for your yes. When it is done, type `/ar-help` to see every command.

**Only paste instructions you trust.** This prompt tells your agent to download and follow files from this repo. Read [SKILL.md](skills/agent-ready/SKILL.md) once first. If you fork the repo, change `Bbhuva/agent-ready` above to your fork, so you always get the version you read.
