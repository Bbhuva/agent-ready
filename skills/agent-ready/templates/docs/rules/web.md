# Ready for visiting agents

Load this when you build or change a page, a form, an API route or sign-in, or the files the site serves to crawlers (`robots.txt`, the sitemap, `llms.txt`). The operator overrides in `AGENTS.md` beat anything here.

**Visiting agents** are the AI tools that read or use the finished product, not the coding agents that build it. They arrive in three ways:

| Kind | How it sees the product | What it needs |
| --- | --- | --- |
| Crawlers and fetchers (AI search, an assistant opening a link) | One request for the HTML. Most don't run JavaScript | The content in the first response, and the files in "Public pages" |
| Browser agents (an assistant driving a real browser for a person) | The accessibility tree, sometimes screenshots | Everything in "Every page", on signed-in screens too |
| API and tool callers | The API, or an MCP server | "An API" and "Behind sign-in" |

These standards are young, and the scanners that grade them change often. Each part below says how far to go by default. The goal is that an agent can read the product and finish a task in it, not a perfect score.

## Every page (always)

This is ordinary good HTML. It is also what Lighthouse's Agentic Browsing audits check, and it costs nothing extra when done from the first page.

1. **The content is in the first HTML response.** Render pages on the server, or build them ahead of time. An empty page that JavaScript fills in later is invisible to most crawlers. Screens behind sign-in are the exception.
2. **Use the real element.** `<a href>` to go somewhere, `<button>` to do something, `<form>` with a `<label>` for each field, one `<h1>`, headings in order, and `<header>`, `<nav>`, `<main>` and `<footer>`. Never a clickable `<div>`.
3. **Every control has a name a program can read:** visible text, a `<label for>`, or an `aria-label` on an icon-only button. Inputs carry `name`, `type` and `autocomplete`. Nothing a person can click is hidden from the accessibility tree by `aria-hidden` or a role that doesn't fit.
4. **Every state has an address.** A filter, a tab, a page of results or an opened record changes the URL, so an agent can link to it, reload it and go back.
5. **Nothing jumps.** Give images, videos and embeds a width and height, keep space for content that loads late, and never insert content above what is already on screen. Keep Cumulative Layout Shift under 0.1: a browser agent clicks where the button was.
6. **Status codes tell the truth.** A missing page is a 404, not a 200 that says "not found". A form error is text next to its field, tied to it with `aria-describedby`, not only a colour or a message that disappears.
7. **Nothing needs a mouse or good timing.** No action exists only on hover or by dragging. A step that cannot be undone (delete, pay, send) asks first, in a dialog with clearly named buttons.
8. **Say what the page is.** A `<title>`, a meta description and a canonical link on every public page, and JSON-LD for the thing it is about: a product, an article, an event, the organisation.
9. **No human check in front of reading.** Keep CAPTCHAs for sign-up, sign-in and anything that costs money. Protect the rest with rate limits.

## Public pages (every public site)

Generate these at build time from the same list of routes or content as the pages themselves, so they cannot go stale. Never write them by hand.

| Serve | What goes in it |
| --- | --- |
| `/robots.txt` as `text/plain` | Rules under `User-agent: *`, a `Disallow` for the signed-in app, admin, API and search-result paths, the crawler policy below, and a `Sitemap:` line |
| `/sitemap.xml` | The canonical address of every public page, and nothing behind sign-in |
| `/llms.txt` | Markdown: `# Name`, a one-line `>` summary, then `##` sections of links to the pages that matter most, each with a few words on what it holds. It must contain links, not only text |
| A Markdown version of each content page | A request with `Accept: text/markdown` gets the same content back as `Content-Type: text/markdown`, with `Vary: Accept`. HTML stays the default. Use the host's own feature if it has one, otherwise a small route or middleware. Point to it with `<link rel="alternate" type="text/markdown">` |
| `Link` headers on the home page | Pointers to what exists, and only that: `</llms.txt>; rel="describedby"`, and for an API `</.well-known/api-catalog>; rel="api-catalog"` |

**The crawler policy is the operator's decision.** Ask once, in plain words, and log the answer in `docs/build/decisions.md`. There are three kinds of AI crawler, and each can be treated differently:

- **Search crawlers** (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) fetch the pages AI answers quote. Blocking them takes the site out of those answers.
- **Fetchers a person triggers** (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) open a page because someone asked about it.
- **Training crawlers** (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`) collect text to train models. Blocking them does not change AI search.

Until the operator answers, allow the first two and say no to training, logged as "agent default, please confirm". Write the policy twice in `robots.txt`: as `User-agent` groups for the crawlers above, and as one Content Signals line under `User-agent: *`:

```text
Content-Signal: search=yes, ai-input=yes, ai-train=no
```

`robots.txt` is a request, not a lock. Anything private needs sign-in, as `docs/security.md` says.

## An API (when the project has one)

- Generate an OpenAPI description from the route code (see "Generated docs" in `docs/rules/docs.md`), and serve it at a fixed address.
- Serve `/.well-known/api-catalog` as `application/linkset+json` (RFC 9727). For each API it lists the `anchor` address, `service-desc` (the OpenAPI file), `service-doc` (the docs for people) and `status` (a health check).
- API routes always answer in JSON, with the right status code. Never an HTML error page, and never a redirect to the sign-in page: an agent cannot tell either from success.
- An error has a stable code a program can match, and a plain message. Too many requests is a 429 with `Retry-After`. Lists are paged.
- A request that charges, sends or creates accepts an idempotency key, so a retry does not do it twice.

## Behind sign-in

An agent acts for one person, with that person's permission, and never with more rights than that person has. The server checks every request the same way, whoever sends it (`docs/security.md`). There are two ways in. Build the first always, and the second when the operator wants other tools to connect.

**1. In the person's own browser, already signed in.** The agent uses the screens a person uses, so "Every page" applies to every signed-in screen, apart from rule 1. Also:

- When a session ends, send the person to sign-in, and bring them back to the same address afterwards.
- Never ask an agent to type a password, and never build a way around sign-in or two-step checks for "bots". The person signs in, then the agent carries on.
- Signed-in responses send `Cache-Control: private`, and their addresses stay out of the sitemap and `llms.txt`. A Markdown version of a signed-in page runs the same permission check as the HTML.
- The public side (home, pricing, docs, the sign-in page) follows "Public pages", so an agent can find out what the product does and where to sign in.

**2. Through the API or an MCP server, with a permission of its own.**

- Use OAuth 2.1 with PKCE, from the sign-in provider in `docs/stack.md`. Don't write your own, and never accept a person's password or session cookie from an agent.
- Publish where to sign in, so an agent does not have to guess: `/.well-known/oauth-protected-resource` (RFC 9728) with `resource`, `authorization_servers`, `scopes_supported` and `bearer_methods_supported`, and the sign-in server's own `/.well-known/oauth-authorization-server` or `/.well-known/openid-configuration`.
- A request without a valid token gets a 401 with `WWW-Authenticate: Bearer resource_metadata="<the address of that first file>"`. A valid token without the right gets a 403.
- Scopes are narrow: reading apart from writing, and deleting, paying and sending apart from both. Tokens are short-lived and can be withdrawn. In their settings, the person can see which tools are connected and disconnect one.
- Rate limit by token. Log which tool did what, for which person.
- An MCP server is worth adding when the operator wants assistants to use the product directly. Serve it over HTTP with the same OAuth, describe it at `/.well-known/mcp/server-card.json`, and keep it to a few tools, each named after what it does.

## Tools on the page: WebMCP (experimental)

WebMCP lets a page tell a browser agent what it can do, so the agent calls a named tool instead of guessing at buttons. In late 2026 it works only in Chrome, as a trial. Browsers that don't know it ignore it.

- **Forms, by default:** add `toolname` and `tooldescription` to the main forms (search, contact, sign-up, booking), and `toolparamdescription` to their inputs. Name the action, like `book_appointment`.
- **Scripted tools, only if the operator asks:** `document.modelContext.registerTool()` with a `name`, a `description`, an `inputSchema` and an `execute` function. Check that the API exists before calling it. Register only what fits the current screen, remove a tool when it stops applying, and stay well under 40.
- A tool runs as the signed-in person. The server still checks every call, and anything that cannot be undone asks the person first.

## Not by default

Scanners also look for the files below. A missing one is not a bug. Add one only when the operator wants what it does, and log why in `docs/build/decisions.md`:

- An A2A agent card (`/.well-known/agent-card.json`): the product is itself an agent that other agents talk to.
- An agent skills index (`/.well-known/agent-skills/index.json`): the project publishes skills for coding agents.
- An ARD catalogue (`/.well-known/ard.json`; older tools read `ai-catalog.json`): there are several MCP servers, agents or skills to list.
- `/auth.md`: agents sign themselves up for accounts.
- DNS records for agent discovery, and Web Bot Auth: for a site that sends bot traffic of its own.
- Payment protocols for agents (x402, MPP, UCP, ACP): the operator wants agents to pay.

Read the current spec before building any of them. They are drafts, and what you remember may be out of date.

## How to check

For every item that touches a page or a route, start the app and run `node .agents/scripts/webcheck.mjs <address>` (the operator types `/ar-web`). It reads the site the way a visiting agent does, with GET requests only, and prints OK, LOOK and FIX lines. Add `--page <path>` for each main page, `--api <path>` for a route that needs sign-in, and `--private` for a signed-in app or a local tool. Fix every FIX line, and judge each LOOK line. An item is not done while a FIX line is left: this is part of the definition of done in `docs/rules/workflow.md` and of the item review in `docs/rules/review.md`.

It checks the rows below, apart from the last. To check one by hand (in Windows PowerShell, type `curl.exe`):

| Check | Command | Passes when |
| --- | --- | --- |
| Content without JavaScript | `curl -s <page>` | The main heading and the text are in the output |
| Root files | `curl -sI <site>/robots.txt`, then `/sitemap.xml` and `/llms.txt` | Each is a 200 with the right content type |
| Markdown version | `curl -si -H "Accept: text/markdown" <page>` | The headers say `Content-Type: text/markdown`, and the body is the page's text |
| Pointers | `curl -sI <site>/` | The `Link` header names only files that exist |
| The API without a token | `curl -i <api route>` | A 401 in JSON with `WWW-Authenticate`, not a page or a redirect |
| Names, order and layout, after JavaScript has run | An accessibility check in a browser, and Lighthouse's Agentic Browsing audits (Chrome 150 or newer) | No control without a name, and no layout shift |

Once the site is public, two scanners grade it from outside: isitagentready.com (levels 0 to 5) and PageSpeed Insights (the same Lighthouse audits). Scan only an address that is already public. Aim for level 3 on a content site, and level 4 once there is an API catalogue or an MCP server. Anything higher needs the files in "Not by default".

## In the plan

- A project with public pages serves rule 1 and the root files from its first release, as part of phase 1's skeleton. Adding them to a finished site is far more work.
- An item that adds a page, a form or a route lists the checks above that apply among its acceptance checks.
- When shaping, ask the operator who may crawl the site (see the crawler policy), and whether other tools should connect to it: the API, an MCP server, WebMCP. Log both answers.
