#!/usr/bin/env node
// agent-ready web check
//
// Looks at a site the way a visiting AI agent does, and says in plain words
// what such an agent can and cannot use: the text in the first HTML response,
// names on buttons, links and fields, honest status codes, robots.txt, the
// sitemap, llms.txt, a Markdown version of the page, and how API routes answer
// without sign-in. The rules it checks are in docs/rules/web.md.
//
// It only reads: every request is a GET, to the address you give it. It reads
// the HTML as sent, so it cannot see what appears after JavaScript runs. A
// browser accessibility check is still needed for that.
// No dependencies. Node 18 or newer.
//
//   node .agents/scripts/webcheck.mjs http://localhost:3000
//   node .agents/scripts/webcheck.mjs https://example.com --page /pricing --page /docs
//   node .agents/scripts/webcheck.mjs http://localhost:3000 --api /api/items
//   node .agents/scripts/webcheck.mjs http://localhost:3000 --private
//
//   --page <path>   also check this page (repeat for more)
//   --api <path>    an API route that needs sign-in: check how it answers without a token (repeat for more)
//   --private       a signed-in app or a local tool: leave out the checks for public sites
//   --json          the same results, for a script
//   exit code 1 if anything needs fixing

import path from "node:path";
import { pathToFileURL } from "node:url";

const AGENT = "agent-ready-webcheck";
const MAX_BODY = 2_000_000;
const MIN_WORDS = 25;
const AI_CRAWLERS = /user-agent\s*:\s*(OAI-SearchBot|Claude-SearchBot|PerplexityBot|ChatGPT-User|Claude-User|Perplexity-User|GPTBot|ClaudeBot|Google-Extended|Applebot-Extended|CCBot)/i;

async function get(url, { accept = "text/html,*/*;q=0.8", redirect = "follow", timeout = 10000 } = {}) {
  try {
    const response = await fetch(url, { redirect, headers: { "User-Agent": AGENT, Accept: accept }, signal: AbortSignal.timeout(timeout) });
    const body = (await response.text()).slice(0, MAX_BODY);
    return { ok: true, status: response.status, type: (response.headers.get("content-type") ?? "").toLowerCase(), headers: response.headers, body, url: response.url || String(url) };
  } catch (error) {
    return { ok: false, status: 0, type: "", headers: new Headers(), body: "", url: String(url), error: error?.cause?.code ?? error?.name ?? "error" };
  }
}

// ---- Reading HTML without a parser: good enough to count, not to render ----

const attr = (tag, name) => {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
};
const hasAttr = (tag, name) => new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`, "i").test(tag);
const stripBlocks = (html) => html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
const textOf = (html) =>
  html
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
const opening = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => ({ attrs: m[1], index: m.index }));
const paired = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, "gi"))].map((m) => ({ attrs: m[1], inner: m[2], index: m.index, end: m.index + m[0].length }));

// A name a program can read: its own label, its text, or the name of an image or icon inside it.
function nameOf(attrs, inner = "") {
  if ((attr(attrs, "aria-label") ?? "").trim() || attr(attrs, "aria-labelledby") || (attr(attrs, "title") ?? "").trim()) return true;
  if (textOf(inner.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, (svg) => (/<title\b[^>]*>\s*\S/i.test(svg) ? " icon " : " ")))) return true;
  return opening(inner, "img").some((img) => (attr(img.attrs, "alt") ?? "").trim()) || opening(inner, "svg").some((svg) => (attr(svg.attrs, "aria-label") ?? "").trim());
}

export function readPage(html) {
  const clean = stripBlocks(html);
  const body = clean.match(/<body\b[^>]*>([\s\S]*)/i)?.[1] ?? clean;
  const words = textOf(body).split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  const links = opening(clean, "link");
  const metas = opening(clean, "meta");
  const labels = paired(clean, "label");
  const labelFor = new Set(labels.map((label) => attr(label.attrs, "for")).filter(Boolean));

  const unnamedButtons = paired(clean, "button").filter((button) => !nameOf(button.attrs, button.inner)).length;
  const anchors = paired(clean, "a");
  const unnamedLinks = anchors.filter((a) => hasAttr(a.attrs, "href") && !nameOf(a.attrs, a.inner)).length;
  const deadLinks = anchors.filter((a) => !hasAttr(a.attrs, "href") && !hasAttr(a.attrs, "id") && !hasAttr(a.attrs, "name")).length;
  const images = opening(clean, "img");
  const noAlt = images.filter((img) => !hasAttr(img.attrs, "alt")).length;
  const noSize = images.filter((img) => !(hasAttr(img.attrs, "width") && hasAttr(img.attrs, "height"))).length;
  const fields = [...opening(clean, "input"), ...opening(clean, "select"), ...opening(clean, "textarea")].filter((field) => !/^(hidden|submit|button|reset|image)$/i.test(attr(field.attrs, "type") ?? ""));
  const unnamedFields = fields.filter((field) => {
    if ((attr(field.attrs, "aria-label") ?? "").trim() || attr(field.attrs, "aria-labelledby") || (attr(field.attrs, "title") ?? "").trim()) return false;
    const id = attr(field.attrs, "id");
    if (id && labelFor.has(id)) return false;
    return !labels.some((label) => field.index > label.index && field.index < label.end);
  }).length;
  const fakeButtons = [...opening(clean, "div"), ...opening(clean, "span")].filter((tag) => hasAttr(tag.attrs, "onclick") || /^(button|link)$/i.test(attr(tag.attrs, "role") ?? "")).length;
  const forms = opening(clean, "form");

  return {
    words,
    emptyShell: /<div\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt)["']?[^>]*>\s*<\/div>/i.test(clean),
    title: textOf(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: metas.some((meta) => /^description$/i.test(attr(meta.attrs, "name") ?? "") && (attr(meta.attrs, "content") ?? "").trim()),
    canonical: links.some((link) => /\bcanonical\b/i.test(attr(link.attrs, "rel") ?? "")),
    markdownLink: links.some((link) => /\balternate\b/i.test(attr(link.attrs, "rel") ?? "") && /text\/markdown/i.test(attr(link.attrs, "type") ?? "")),
    h1: opening(clean, "h1").length,
    main: opening(clean, "main").length > 0 || /role\s*=\s*["']?main/i.test(clean),
    jsonLd: /<script\b[^>]*type\s*=\s*["']?application\/ld\+json/i.test(html),
    unnamedButtons,
    unnamedLinks,
    deadLinks,
    noAlt,
    noSize,
    images: images.length,
    fields: fields.length,
    unnamedFields,
    fakeButtons,
    forms: forms.length,
    toolForms: forms.filter((form) => hasAttr(form.attrs, "toolname") && hasAttr(form.attrs, "tooldescription")).length,
  };
}

// Git Bash on Windows rewrites an argument like /api/items into
// C:/Program Files/Git/api/items before this script sees it. Put the path back.
export function sitePath(value) {
  const rewritten = String(value).match(/^[A-Za-z]:[\\/](?:.*?[\\/])?(?:Git|msys64|msys32|cygwin64)[\\/](.*)$/);
  return rewritten ? `/${rewritten[1].replace(/\\/g, "/")}` : String(value);
}

function siteUrl(value, origin) {
  try {
    const url = new URL(sitePath(value), origin);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const looksLikePage = (response) => response.type.includes("html") || /^\s*<(!doctype|html)\b/i.test(response.body);

// ---- The checks ----

async function checkPage(add, url, { isPublic, timeout }) {
  const where = new URL(url).pathname;
  const response = await get(url, { timeout });
  if (!response.ok) return add("fail", "page", `${where} could not be reached`, `The request failed (${response.error}). Is the app running at this address?`), null;
  if (response.status >= 400) return add("fail", "page", `${where} answers ${response.status}`, "A visiting agent gets an error instead of the page."), null;
  if (!looksLikePage(response)) return add("warn", "page", `${where} is not an HTML page`, `It is sent as ${response.type || "an unknown type"}, so the page checks were left out.`), response;

  const page = readPage(response.body);
  if (isPublic) {
    if (page.words < MIN_WORDS)
      add("fail", "page-text", `${where} has almost no text in its first HTML (${plural(page.words, "word")})`, `Most AI crawlers don't run JavaScript, so they see an empty page${page.emptyShell ? " (an empty app container was found)" : ""}. Render it on the server, or build it ahead of time.`);
    else add("ok", "page-text", `${where} sends its text in the first HTML (${page.words} words)`);
  }

  if (!page.title) add("fail", "page-title", `${where} has no <title>`, "The title is the first thing an agent reads to tell pages apart.");
  else if (page.h1 === 0) add("fail", "page-heading", `${where} has no <h1>`, "Give every page one main heading.");
  else if (page.h1 > 1) add("warn", "page-heading", `${where} has ${page.h1} <h1> headings`, "Keep one main heading, and use <h2> and below for the rest.");
  else add("ok", "page-heading", `${where} has a title and one main heading`);
  if (!page.main) add("warn", "page-landmarks", `${where} has no <main>`, "Wrap the page's own content in <main>, so an agent can skip the header and footer.");

  const unnamed = [page.unnamedButtons && plural(page.unnamedButtons, "button"), page.unnamedLinks && plural(page.unnamedLinks, "link"), page.noAlt && `${plural(page.noAlt, "image")} without alt`].filter(Boolean);
  if (unnamed.length) add("fail", "page-names", `${where} has controls an agent cannot name: ${unnamed.join(", ")}`, 'Give each one visible text or an aria-label, and every image an alt (alt="" for decoration).');
  else add("ok", "page-names", `${where}: every button, link and image has a name`);
  if (page.unnamedFields) add("warn", "page-fields", `${where}: ${plural(page.unnamedFields, "form field")} of ${page.fields} may have no label`, "Tie a <label for> to each field, or add an aria-label. A placeholder is not a name.");
  if (page.fakeButtons) add("warn", "page-elements", `${where}: ${plural(page.fakeButtons, "<div> or <span>", "<div>s or <span>s")} acting as a button or link`, "Use a real <button> or <a href>, which agents and keyboards already understand.");
  if (page.deadLinks) add("warn", "page-elements", `${where}: ${plural(page.deadLinks, "link")} without an href`, "A link an agent can follow needs an href. For an action, use a <button>.");
  if (page.noSize) add("warn", "page-layout", `${where}: ${plural(page.noSize, "image")} of ${page.images} without a width and height`, "Without a size the page jumps as images load, and a browser agent clicks the wrong place.");
  if (isPublic) {
    const missing = [!page.description && "a meta description", !page.canonical && "a canonical link", !page.jsonLd && "JSON-LD for what the page is about"].filter(Boolean);
    if (missing.length) add("warn", "page-meta", `${where} is missing ${missing.join(", ")}`, "These tell an agent what the page is before it reads it.");
  }
  if (page.forms && page.toolForms === page.forms) add("ok", "page-forms", `${where}: ${plural(page.forms, "form")} described as a tool for browser agents`);
  else if (page.forms) add("warn", "page-forms", `${where}: ${page.forms - page.toolForms} of ${plural(page.forms, "form")} not described as a tool`, "Experimental, and only Chrome reads it so far: toolname and tooldescription on a <form> let a browser agent use it by name (WebMCP, docs/rules/web.md).");
  return { ...response, page };
}

async function checkNotFound(add, origin, timeout) {
  const response = await get(new URL(`/agent-ready-check-${Date.now().toString(36)}`, origin), { timeout });
  if (!response.ok) return;
  if (response.status === 404 || response.status === 410) add("ok", "not-found", "A page that does not exist answers 404");
  else if (response.status === 200) add("fail", "not-found", "A page that does not exist answers 200", "An agent cannot tell a missing page from a real one. Answer 404 for addresses that don't exist.");
  else add("warn", "not-found", `A page that does not exist answers ${response.status}`, "404 is what agents expect for a missing page.");
}

async function checkPublicFiles(add, origin, home, timeout) {
  // robots.txt
  const robots = await get(new URL("/robots.txt", origin), { accept: "text/plain,*/*;q=0.5", timeout });
  let sitemapUrls = [];
  if (!robots.ok || robots.status !== 200) add("fail", "robots", "There is no /robots.txt", `It answers ${robots.status || robots.error}. Serve one that says what crawlers may read, with a Sitemap line.`);
  else if (looksLikePage(robots)) add("fail", "robots", "/robots.txt answers with a web page", "The app sends a page for every address. Serve a real text file there.");
  else if (!/user-agent\s*:/i.test(robots.body)) add("fail", "robots", "/robots.txt has no User-agent rules", "Add at least a `User-agent: *` group.");
  else {
    add("ok", "robots", `/robots.txt is there${robots.type.includes("text/plain") ? "" : ` (sent as ${robots.type || "no type"}; text/plain is expected)`}`);
    sitemapUrls = [...robots.body.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
    if (/content-signal\s*:/i.test(robots.body) || AI_CRAWLERS.test(robots.body)) add("ok", "robots-policy", "/robots.txt says what AI crawlers may do");
    else add("warn", "robots-policy", "/robots.txt does not say what AI crawlers may do", "Who may crawl the site is the operator's decision: ask, log it, and write it as User-agent groups and one Content-Signal line (docs/rules/web.md).");
  }

  // The sitemap
  const candidates = sitemapUrls.length ? sitemapUrls : [new URL("/sitemap.xml", origin).href];
  let sitemap = null;
  for (const candidate of candidates.slice(0, 3)) {
    let target;
    try {
      target = new URL(candidate, origin);
    } catch {
      continue;
    }
    const response = await get(target, { accept: "application/xml,text/xml,*/*;q=0.5", timeout });
    if (response.ok && response.status === 200 && /<(urlset|sitemapindex)\b/i.test(response.body)) {
      sitemap = { url: target, count: (response.body.match(/<loc\b/gi) ?? []).length };
      break;
    }
  }
  if (!sitemap) add("fail", "sitemap", "There is no sitemap", `Nothing valid at ${candidates[0]}. Generate /sitemap.xml from the list of public pages, and name it in robots.txt.`);
  else {
    add("ok", "sitemap", `The sitemap lists ${plural(sitemap.count, "address", "addresses")}`);
    if (!sitemapUrls.length && robots.ok && robots.status === 200) add("warn", "sitemap-line", "/robots.txt does not name the sitemap", `Add the line: Sitemap: ${sitemap.url.href}`);
  }

  // llms.txt
  const llms = await get(new URL("/llms.txt", origin), { accept: "text/plain,text/markdown,*/*;q=0.5", timeout });
  if (!llms.ok || llms.status !== 200) add("fail", "llms", "There is no /llms.txt", "Serve a short Markdown summary there: `# Name`, a one-line summary, then links to the pages that matter most.");
  else if (looksLikePage(llms)) add("fail", "llms", "/llms.txt answers with a web page", "The app sends a page for every address. Serve a real Markdown file there.");
  else {
    const links = (llms.body.match(/\[[^\]]+\]\([^)\s]+\)/g) ?? []).length;
    const titled = /^\s*#\s+\S/.test(llms.body);
    if (!titled || !links) add("fail", "llms", `/llms.txt is there but ${!titled ? "does not start with a `# Name` line" : "holds no links"}`, "It needs a title line and Markdown links to the main pages, each with a few words on what it holds.");
    else add("ok", "llms", `/llms.txt has a title and ${plural(links, "link")}`);
  }

  // A Markdown version of the home page
  const markdown = await get(home, { accept: "text/markdown", timeout });
  if (markdown.ok && markdown.status === 200 && markdown.type.includes("text/markdown")) {
    const varies = /accept/i.test(markdown.headers.get("vary") ?? "");
    add(varies ? "ok" : "warn", "markdown", "The home page comes back as Markdown when asked", varies ? "" : "Add the header `Vary: Accept`, or a cache may hand the Markdown to a browser.");
  } else add("warn", "markdown", "The home page has no Markdown version", "A request with `Accept: text/markdown` still gets HTML. Agents read Markdown faster and cheaper. Use the host's own feature if it has one, otherwise a small route (docs/rules/web.md).");
}

async function checkLinkHeader(add, origin, homeResponse, timeout) {
  const header = homeResponse?.headers.get("link") ?? "";
  const targets = [...header.matchAll(/<([^>]+)>\s*;([^,]*)/g)].map((m) => ({ href: m[1], rel: m[2].match(/rel\s*=\s*"?([^";]+)"?/i)?.[1]?.trim() ?? "" }));
  const useful = targets.filter((target) => /\b(describedby|api-catalog|service-desc|service-doc)\b/i.test(target.rel));
  if (!useful.length) return add("warn", "link-header", "The home page sends no Link header for agents", 'One line points agents at what exists, for example: Link: </llms.txt>; rel="describedby"');
  const broken = [];
  for (const target of useful) {
    let url;
    try {
      url = new URL(target.href, origin);
    } catch {
      broken.push(target.href);
      continue;
    }
    if (url.origin !== origin) continue;
    const response = await get(url, { accept: "*/*", timeout });
    if (!response.ok || response.status >= 400) broken.push(`${target.href} (${response.status || response.error})`);
  }
  if (broken.length) add("fail", "link-header", "The Link header points at files that are not there", `${broken.join(", ")}. Point only at what exists.`);
  else add("ok", "link-header", `The Link header points agents at ${useful.map((target) => target.href).join(", ")}`);
}

async function checkApi(add, origin, route, timeout) {
  const url = siteUrl(route, origin);
  if (!url) return add("fail", "api", `${route} is not an address`, "Give a path like /api/items.");
  const where = url.pathname;
  const response = await get(url, { accept: "application/json", redirect: "manual", timeout });
  if (!response.ok) return add("fail", "api", `${where} could not be reached`, `The request failed (${response.error}).`);
  const json = response.type.includes("json");
  if (response.status >= 300 && response.status < 400) return add("fail", "api", `${where} redirects when there is no token (${response.status} to ${response.headers.get("location") ?? "another page"})`, "An agent follows the redirect and takes the sign-in page for the answer. Answer 401 in JSON instead.");
  if (response.status === 404) return add("fail", "api", `${where} answers 404`, "Check the path. A route that needs sign-in answers 401, not 404.");
  if (response.status === 200 && !json) return add("fail", "api", `${where} answers 200 with ${response.type || "no content type"} when there is no token`, "An API route answers in JSON, with 401 when sign-in is needed. Never a web page.");
  if (response.status === 200) return add("warn", "api", `${where} answers without sign-in`, "Fine if this route is meant to be public. If it needs sign-in, it must answer 401.");
  if (response.status !== 401 && response.status !== 403) return add("warn", "api", `${where} answers ${response.status} when there is no token`, "401 is what agents expect when sign-in is needed.");
  if (!json) return add("fail", "api", `${where} answers ${response.status} with ${response.type || "no content type"}`, "Send the error as JSON, with a code a program can match.");

  const challenge = response.headers.get("www-authenticate") ?? "";
  const metadata = challenge.match(/resource_metadata\s*=\s*"([^"]+)"/i)?.[1];
  if (!metadata) return add("warn", "api", `${where} answers ${response.status} in JSON, but does not say where to sign in`, 'Fine for a private API. If other tools should connect, add: WWW-Authenticate: Bearer resource_metadata="<site>/.well-known/oauth-protected-resource"');
  let described = null;
  try {
    const target = new URL(metadata, origin);
    if (/^https?:$/.test(target.protocol)) described = JSON.parse((await get(target, { accept: "application/json", timeout })).body);
  } catch {
    described = null;
  }
  if (described?.resource && Array.isArray(described.authorization_servers) && described.authorization_servers.length) add("ok", "api", `${where} answers 401 in JSON and says where to sign in`);
  else add("fail", "api", `${where} points at sign-in details that are missing or incomplete`, `${metadata} must be JSON with "resource" and "authorization_servers" (RFC 9728).`);
}

// Files other tools look for. Only reported when they exist, or when they are broken.
async function checkWellKnown(add, origin, timeout) {
  const found = [];
  const file = async (pathname, valid, name, need) => {
    const response = await get(new URL(pathname, origin), { accept: "application/json,*/*;q=0.5", timeout });
    if (!response.ok || response.status !== 200 || looksLikePage(response)) return;
    let data = null;
    try {
      data = JSON.parse(response.body);
    } catch {
      data = null;
    }
    if (data && valid(data)) found.push(name);
    else add("fail", "well-known", `${pathname} is there but not valid`, need);
  };
  await file("/.well-known/api-catalog", (data) => Array.isArray(data.linkset), "an API catalogue", 'It must be JSON with a "linkset" list (RFC 9727).');
  await file("/.well-known/oauth-protected-resource", (data) => data.resource && Array.isArray(data.authorization_servers), "sign-in details for tools", 'It must be JSON with "resource" and "authorization_servers" (RFC 9728).');
  await file("/.well-known/mcp/server-card.json", (data) => data.serverInfo?.name || data.name, "an MCP server card", 'It must be JSON with "serverInfo" holding a name and version.');
  if (found.length) add("ok", "well-known", `Also found: ${found.join(", ")}`);
}

export async function checkSite(site, { pages = [], apis = [], isPublic = true, timeout = 10000 } = {}) {
  const results = [];
  const add = (status, id, title, detail = "") => results.push({ status, id, title, detail });
  let home;
  try {
    home = new URL(/^https?:\/\//i.test(site) ? site : `http://${site}`);
  } catch {
    add("fail", "address", `"${site}" is not an address`, "Give the site's address, like http://localhost:3000 or https://example.com.");
    return results;
  }
  const origin = home.origin;

  const homeResponse = await checkPage(add, home.href, { isPublic, timeout });
  if (!homeResponse && results[0]?.title.includes("could not be reached")) return results; // nothing is listening: one clear line beats twenty
  for (const page of pages) {
    const url = siteUrl(page, origin);
    if (url) await checkPage(add, url.href, { isPublic, timeout });
    else add("fail", "page", `${page} is not an address`, "Give a path like /pricing.");
  }
  await checkNotFound(add, origin, timeout);
  if (isPublic) {
    await checkPublicFiles(add, origin, home.href, timeout);
    await checkLinkHeader(add, origin, homeResponse, timeout);
  }
  for (const route of apis) await checkApi(add, origin, route, timeout);
  await checkWellKnown(add, origin, timeout);
  return results;
}

function print(site, results) {
  const label = { ok: "OK  ", warn: "LOOK", fail: "FIX " };
  const lines = [`How ${site} looks to a visiting AI agent:`, "", ...results.map((r) => `${label[r.status]}  ${r.title}${r.detail ? `\n      ${r.detail}` : ""}`)];
  const ok = results.filter((r) => r.status === "ok").length;
  const fails = results.filter((r) => r.status === "fail").length;
  const looks = results.filter((r) => r.status === "warn").length;
  lines.push("", `Web check: ${ok} of ${results.length} OK${fails ? `, ${fails} to fix` : ""}${looks ? `, ${looks} to look at` : ""}.`);
  lines.push("It reads the HTML as sent, so it cannot see what JavaScript adds later. The rules are in docs/rules/web.md.");
  return lines.join("\n");
}

const USAGE = `Give the site's address:
  node .agents/scripts/webcheck.mjs http://localhost:3000
  node .agents/scripts/webcheck.mjs https://example.com --page /pricing --api /api/items
  --private leaves out the checks for public sites (a signed-in app or a local tool).`;

export async function main(argv = process.argv) {
  const args = argv.slice(2);
  const all = (flag) => args.flatMap((arg, index) => (arg === flag && args[index + 1] ? [args[index + 1]] : []));
  const valued = new Set(["--page", "--api"]);
  const site = args.find((arg, index) => !arg.startsWith("--") && !valued.has(args[index - 1]));
  if (!site) {
    console.log(USAGE);
    return 1;
  }
  const results = await checkSite(site, { pages: all("--page"), apis: all("--api"), isPublic: !args.includes("--private") });
  console.log(args.includes("--json") ? JSON.stringify(results, null, 2) : print(site, results));
  return results.some((r) => r.status === "fail") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
