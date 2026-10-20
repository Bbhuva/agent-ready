# Choosing a tech stack

A guide for you, the agent running the setup. Read it in Step 2 when the stack is not clear. Never copy it into the project.

There is no house stack. Start from what the person wants to build, where it runs, and what they already know, and suggest the simplest stack that does the job well.

## When to ask

- **Existing project:** don't ask. The stack is what the repo uses. Write it into `docs/stack.md` from what you found.
- **New project, stack named in full** (for example "Laravel and MySQL", or "Next.js, Supabase and Vercel"): don't ask. Fill the gaps (tests, CI, hosting) from the tables below and show them in the plan. If a part they named would hold back what they want to build, say so once, with the reason (see "Fit beats habit"), and follow their answer.
- **New project, stack partly named** ("a React app", "something in PHP") **or not named:** ask the questions below.
- **The person says "you pick":** answer the questions yourself from what they want to build, and say so in the plan.

## The questions

Add them to Step 2's message as a second short list, headed: *"Do you already have a tech stack in mind? If so, name it and skip these."* Each one has a default, so "use the defaults" is a full answer. Skip any the idea already answers.

1. **Where does it run?** Only on your own computer / on your home or office network / online, for other people. *(Default: online if other people will use it; otherwise only on your computer.)*
2. **Where will people use it?** In a web browser / a phone app from the app stores / both / a desktop app / nowhere visible (an API, a script, an automation) / a browser extension. *(Default: in a web browser, on phones and computers.)*
3. **What does it need?** Any of: user accounts, saving data, payments, file or photo uploads, live updates (chat, shared editing, live dashboards), AI features, emails or notifications, scheduled or background jobs, working offline. *(Default: what the idea describes.)*
4. **Which languages or tools do you already know?** For example PHP and Laravel, Python, JavaScript, WordPress, or none yet. Also any services you already have accounts with, and anything you must use or avoid. *(Default: none, so pick the most common, best-documented option.)*
5. **How big, how sensitive, and what budget?** Just you / a few people / the public; any health, money, children's or other sensitive data; free tiers only / up to about $25 a month / more. *(Default: under a thousand users, nothing sensitive, free tiers until there are real users.)*

## How to choose

Weigh these in order:

1. **Fit for the job.** Start from what they are building and where it runs (the tables below). Something that runs only on their own computer needs no host and no cloud accounts.
2. **What they already know, when it fits.** A language they know beats a "better" one they don't: they can read the code, judge what agents write, and get help. Suggest it whenever it does the job well.
3. **Fit beats habit.** Don't suggest a language or tool they know when it would become a bottleneck: it can't do a core need well (an app-store phone app, a desktop app, heavy live updates), it would force a second language anyway, hosting for it is hard or costly on their budget, or it is so rarely used that agents write weak code for it. Say so in one sentence, name what you suggest instead and why, and let them decide.
4. **Popular and well documented.** Agents write better code for tools with lots of public examples, and the operator can find help.
5. **Few moving parts.** One language end to end where possible. Managed services with free tiers rather than servers to look after. For an online web app, one host, ideally one that makes a preview link for every branch.
6. **Sensitive data or a large audience** points towards established providers with clear security pages and backups. Say what the operator must check, such as the data region.

**Check before you recommend.** The tables are starting points, not a verdict. Look up current stable versions and pricing in the official docs if you can browse. Don't rely on memory, and say so if you could not check.

## What they are building

| The person wants | A common starting point | If they already know |
| --- | --- | --- |
| A web app with accounts and data | TypeScript with Next.js and a managed Postgres database (for example Supabase or Neon), on a host with preview links (for example Vercel or Netlify) | PHP: Laravel with MySQL or Postgres. Python: Django with Postgres. Ruby: Rails with Postgres. |
| A content site, blog or marketing pages | Astro on a static host (for example Netlify, Cloudflare Pages or Vercel) | WordPress, if they know it or want to edit pages without code |
| A phone app (iOS and Android) | Expo (React Native) with TypeScript, plus an online database if data is shared | Flutter, if they know Dart. A web language on its own can't make an app-store app: that means a second stack. |
| A phone app and a website | Expo and a web app in one repo, sharing one database and one language | Laravel or Django for the website and the API, with Expo for the app |
| An API or backend only | TypeScript with Hono, or Python with FastAPI, with Postgres | PHP: Laravel. Go, if they know it. |
| AI features | The matching row above, plus the AI provider's official SDK | Python, for heavy data or model work |
| Data work, ML or number crunching | Python with uv | |
| A script, CLI or automation | Python with uv, or TypeScript on Node | Whatever they know: scripts rarely need anything special |
| A tool that runs only on their own computer | Python or TypeScript, SQLite for data, and a page on `localhost` if it needs a screen. No host and no cloud accounts; it starts with one command | Whatever they know, as long as it runs on their computer without a server to set up |
| A desktop app | Tauri | Electron, if they only know web tools |
| A browser extension | WXT with TypeScript | |

## Where the data lives

Choose from what the data does, not from the framework:

| The data | Suggest |
| --- | --- |
| Nothing to keep, or a few settings | No database: a file is enough |
| One person, on their own computer | SQLite: one file, no server, nothing to sign up for |
| Shared by many people online, with accounts and linked records (most apps) | Postgres, managed by a provider or the host. MySQL or MariaDB is fine too, and common with PHP hosting. |
| Live updates (chat, shared editing, live dashboards) | A database with live updates built in (for example Supabase, Firebase or Convex), or a live-updates service on top of Postgres |
| A phone app that must work offline | SQLite on the device, synced to the online database |
| Search by meaning, or AI that looks things up in their own documents | Postgres with pgvector first; a separate vector database only when that is not enough |
| Data without a fixed shape | Postgres with JSON columns; MongoDB if they already know it |

Sensitive data needs backups and a region the operator chooses: say so in the plan.

## Everything else

| If it needs | Default |
| --- | --- |
| Sign-in | The framework's own (Laravel, Django and Rails have it), or the database provider's |
| Payments | Stripe (Checkout or Payment Links to start) |
| Email | A transactional email service (for example Resend or Postmark) |
| File uploads | The database provider's storage, or object storage such as S3 or Cloudflare R2 |
| Scheduled or background jobs | The framework's or host's scheduler (for example Laravel's scheduler or a host's cron); a job service only for long jobs |
| Running AI models locally | Ollama, when it must work without a cloud AI account |
| Unit tests | The stack's usual one: Vitest (TypeScript), pytest (Python), Pest or PHPUnit (PHP) |
| End-to-end tests | Playwright (web), Maestro (mobile) |
| CI | GitHub Actions running lint, type checks and tests on every push, when the code is on GitHub |
| Error tracking in production | Sentry, or the host's own alerts |

## Where the code goes

`docs/` is for documents only. Never put code, scripts or build output there. Choose the layout along with the stack:

- **One app** (one thing to run or deploy): the framework's own layout at the project root, such as `src/` and `public/` for Next.js, `app/` and `routes/` for Laravel, or `src/<package>/` and `tests/` for Python. It is what tutorials and agents expect.
- **More than one app** (a website and a phone app, or an app and a separate API): `apps/<name>/` for each thing you run or deploy, and `packages/<name>/` for code they share, using the language's workspaces (for example pnpm workspaces for TypeScript).
- **Files the project produces for people to keep** (reports, exports, generated media): `outputs/`, ignored by git unless the operator wants them kept.
- **Developer scripts:** `scripts/`. **Agent tools:** `.agents/`.
- **Build output and installed packages** (`.next/`, `dist/`, `build/`, `node_modules/`, `vendor/`) stay where the tools put them, ignored by git.

Show the layout in the plan, then write it into the Layout table in `docs/stack.md` and the Map in `AGENTS.md`.

## What to show the person

Put a short stack section in the Step 3 plan:

- **Recommended:** each part on one line, with the reason in plain words. If you did not pick a language they know, say why in one sentence.
- **Layout:** where the code will live (see above).
- **Cost at the start:** per month, and what makes it go up. For a tool that runs only on their computer, say it costs nothing to run.
- **Accounts you will need:** the sign-ups the operator does themselves, or "none".
- **One alternative,** and when it would be the better pick.

Their yes to the plan covers the stack. Write `docs/stack.md` from the template, and log the choice in `docs/build/decisions.md` as an operator decision.
