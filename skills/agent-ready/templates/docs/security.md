# Security

Load this when you touch sign-in, permissions, secrets, payments or user data. The hard rules every session needs are in the "Never" list in `AGENTS.md`. The operator overrides in `AGENTS.md` beat anything here.

## Rules for agents

1. Read secrets from the environment. Never hardcode one, not even in a test.
2. Variables whose names start with `NEXT_PUBLIC_`, `VITE_`, `EXPO_PUBLIC_`, `REACT_APP_` or `PUBLIC_` end up in the browser or the app bundle. Admin and service keys never get one of those names.
3. If you see a secret where it should not be (in code, git history, a log), stop and tell the operator. Treat it as leaked: it needs replacing, not just deleting.
4. Before adding a package, check it really exists, is maintained, and is spelled right. AI tools invent package names, and attackers register them.
5. Every table users can reach has access rules (for example row level security). Check permissions on the server, never only in the UI.
6. Validate input on the server. Rate limit sign-in, anything that sends email or SMS, and anything that calls a paid AI API.
7. Errors shown to users never include stack traces, SQL or keys.

## Where secrets live

- Local development: `.env` (or `.env.local`). Git ignores it. Agents never read it.
- Production: {{the host's secret settings, e.g. "Vercel project settings, Environment Variables"}}.
- The list of names (never values): `.env.example`.

| Variable | Server only or public? | What it is for |
| --- | --- | --- |
| {{NAME}} | {{server only}} | {{what it is for}} |

**Public** means it ends up in the browser or the app bundle, where anyone can read it. Only keys that are designed to be public (like a Stripe publishable key or a Supabase anon key) may be public.

## Who can do what

{{Sign-in method. Roles (user, admin). Where permissions are checked on the server. How admin access is granted.}}

## Data access rules

{{Database access rules, e.g. "Row level security on every table; users read and write only their own rows". List anything deliberately public.}}

## Limits

{{Rate limits on sign-in, email or SMS sending, file uploads and paid AI calls.}}

## Before you go live

The technical half of going live. The rest (money, legal basics, domain and email, phones and accessibility, after launch) is in `docs/operator/launch.md`. Work through this list with an agent. Anything you cannot tick becomes an item, an entry in `docs/operator/todo.md`, or a check in `docs/operator/mtest.md`.

- [ ] No real `.env` or key file is in git, now or in history (`node .agents/hooks/precommit-guard.mjs --scan-repo`).
- [ ] No secret reaches the browser. Search the built site for your key prefixes.
- [ ] Every database table has access rules, and you have tested them as a signed-out user and as a different user.
- [ ] Admin pages and admin API routes check the user is an admin on the server.
- [ ] Sign-in, password reset, email sending and paid AI calls are rate limited.
- [ ] Error pages do not show stack traces, SQL or keys.
- [ ] Dependencies checked for known problems (`npm audit`, `pip-audit` or similar).
- [ ] Test keys and live keys are separate. Live keys exist only in the host's settings.
- [ ] Any key that was ever pasted into a chat, a screenshot or a commit has been replaced.
- [ ] Backups exist and you have restored one at least once.
