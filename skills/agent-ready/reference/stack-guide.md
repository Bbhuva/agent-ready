# Choosing a tech stack

A guide for you, the agent running the setup. Read it in Step 2 when the stack is not clear. Never copy it into the project.

## When to ask

- **Existing project:** don't ask. The stack is what the repo uses. Write it into `docs/stack.md` from what you found.
- **New project, stack named in full** (for example "Next.js, Supabase, Vercel"): don't ask. Fill the gaps (tests, CI, hosting) from the tables below and show them in the plan.
- **New project, stack partly named** ("a React app") **or not named:** ask the questions below.
- **The person says "you pick":** answer the questions yourself with the defaults, and say so in the plan.

## The questions

Add them to Step 2's message as a second short list, headed: *"Do you already have a tech stack in mind? If so, name it and skip these."* Each one has a default, so "use the defaults" is a full answer. Skip any the person already answered.

1. **Where will people use it?** In a web browser / a phone app from the app stores / both / a desktop app / nowhere visible (an API, a script, an automation) / a browser extension. *(Default: in a web browser, on phones and computers.)*
2. **What does it need?** Any of: user accounts, saving data, payments, file or photo uploads, live updates (chat, shared editing, live dashboards), AI features, emails or notifications, scheduled or background jobs, working offline. *(Default: accounts and saving data.)*
3. **How big, and how sensitive?** Just you / a few people / the public, and roughly how many users in the first months. Any health, money, children's or other sensitive data? *(Default: under a thousand users, nothing sensitive.)*
4. **What do you already know or use?** Languages you or your team know, services you already have accounts with (GitHub, Vercel, Supabase, Firebase, AWS, Cloudflare and so on), anything you must use or must avoid. *(Default: nothing. Pick the most common, best-documented tools.)*
5. **Budget per month at the start?** Free tiers only / up to about $25 / more. *(Default: free tiers until there are real users.)*

## How to choose

Weigh these in order:

1. **What the person already knows or uses wins,** unless it clearly cannot do the job. If you override it, say why.
2. **Popular and well documented.** Agents write better code for tools with lots of public examples, and the operator can find help.
3. **One language end to end** where possible. TypeScript covers web, mobile, server and scripts.
4. **Few moving parts.** Managed services with free tiers, rather than servers the operator has to run. One host if possible, and one that makes a preview link for every branch, so the operator can try a change before it goes live.
5. **Sensitive data or a large audience** points towards established providers with clear security and compliance pages and backups. Say what the operator must check, such as the data region or a data processing agreement.

**Check before you recommend.** The tables are starting points, not a verdict. Look up current stable versions and pricing in the official docs if you can browse. Don't rely on memory, and say so if you could not check.

| The person wants | Start from | A good alternative |
| --- | --- | --- |
| A web app with accounts and data | Next.js, TypeScript and Tailwind CSS; Supabase for the database, sign-in and file storage; hosted on Vercel | SvelteKit instead of Next.js; Neon with Better Auth instead of Supabase |
| A content site, blog or marketing pages | Astro, hosted on Vercel, Netlify or Cloudflare | Next.js, if it will grow into an app |
| A phone app (iOS and Android) | Expo (React Native) with TypeScript, and Supabase | Flutter with Firebase, if they know Dart |
| A phone app and a website | Expo for the app and Next.js for the site in one repo, sharing Supabase | Expo alone with its web output, if search ranking does not matter |
| An API or backend only | TypeScript with Hono on Node and Postgres, hosted on Railway, Render or Fly.io | Python with FastAPI |
| AI chat or AI features in a web app | The web app row, plus the Vercel AI SDK | Python with FastAPI, for heavy data or ML work |
| Data work, ML or number crunching | Python with FastAPI, uv for packages, Postgres | |
| A script, CLI or automation | TypeScript on Node, or Python with uv | |
| A browser extension | WXT with TypeScript | |
| A desktop app | Tauri | Electron, if the team only knows web tools |

| If it needs | Default |
| --- | --- |
| Payments | Stripe (Checkout or Payment Links to start) |
| Email | Resend |
| Live updates | Supabase Realtime |
| Scheduled or background jobs | The host's cron (Vercel Cron, Supabase Cron); Inngest or Trigger.dev for long jobs |
| File uploads | Supabase Storage |
| Unit tests | Vitest (TypeScript), pytest (Python) |
| End-to-end tests | Playwright (web), Maestro (mobile) |
| CI | GitHub Actions running lint, type checks and tests on every push |
| Error tracking in production | Sentry |

## Where the code goes

`docs/` is for documents only. Never put code, scripts or build output there. Choose the layout along with the stack:

- **One app** (one thing to deploy): the framework's own layout at the project root, such as `src/` and `public/` for Next.js, or `src/<package>/` and `tests/` for Python. It is what tutorials and agents expect.
- **More than one app** (a website and a phone app, or an app and a separate API): `apps/<name>/` for each thing you deploy, and `packages/<name>/` for code they share, using workspaces (pnpm workspaces for TypeScript; add Turborepo once builds get slow).
- **Files the project produces for people to keep** (reports, exports, generated media): `outputs/`, ignored by git unless the operator wants them kept.
- **Developer scripts:** `scripts/`. **Agent tools:** `.agents/`.
- **Build output** (`.next/`, `dist/`, `build/`) stays where the tools put it, ignored by git.

Show the layout in the plan, then write it into the Layout table in `docs/stack.md` and the Map in `AGENTS.md`.

## What to show the person

Put a short stack section in the Step 3 plan:

- **Recommended:** each part on one line, with the reason in plain words.
- **Layout:** where the code will live (see above).
- **Cost at the start:** per month, and what makes it go up.
- **Accounts you will need:** the sign-ups the operator does themselves.
- **One alternative,** and when it would be the better pick.

Their yes to the plan covers the stack. Write `docs/stack.md` from the template, and log the choice in `docs/build/decisions.md` as an operator decision.
