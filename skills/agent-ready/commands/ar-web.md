---
description: Check how your site or app looks to a visiting AI agent, and fix what gets in its way.
argument-hint: "[address]"
---
Check how the product looks to a visiting AI agent. The operator's words: $ARGUMENTS

1. Find the address. If they gave one, use it. Otherwise start the app as the run card `docs/operator/run.md` says, and use its local address. If this project has no web pages and no API, say so and stop.
2. Run `node .agents/scripts/webcheck.mjs <address>`. Add `--page <path>` for each main page, and `--api <path>` for one or two API routes that need sign-in. For a signed-in app or a tool that runs only on their computer, add `--private`: it leaves out the checks for public sites. It only reads the site: every request is a GET.
3. Explain the result in plain words: what an AI assistant can already read and use, and what gets in its way. Lead with the FIX lines.
4. Fix each FIX line as `docs/rules/web.md` says. A small fix in a page you are already working on: do it now. Anything bigger becomes an item in `docs/build/backlog.md`. For each LOOK line, say what it means, and fix it only if it fits this project.
5. Who may crawl the site is the operator's decision. If `robots.txt` does not say yet, ask in plain words, and log the answer in `docs/build/decisions.md`.
6. The script reads the HTML as sent, so it cannot see what JavaScript adds later. For the main screens, also run the stack's accessibility check in a browser, if it has one.
7. Once the site is live, name the two outside scanners they can try themselves: isitagentready.com and PageSpeed Insights. A missing draft standard there is not a bug: see "Not by default" in `docs/rules/web.md`.

Finish with the "Web check" line from the end of the report.
