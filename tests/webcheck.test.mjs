import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSite, readPage, sitePath } from "../skills/agent-ready/scripts/webcheck.mjs";

const SCRIPT = path.join(fileURLToPath(new URL("../skills/agent-ready/", import.meta.url)), "scripts", "webcheck.mjs");

// A small site on this computer. `routes` maps a path to an answer, or to a
// function of the request; "*" answers every other path.
async function serve(routes, run) {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    let answer = routes[pathname] ?? routes["*"] ?? { status: 404, type: "text/html", body: "<h1>Not found</h1>" };
    if (typeof answer === "function") answer = answer(request, origin);
    response.writeHead(answer.status ?? 200, { "content-type": answer.type ?? "text/html", ...(answer.headers ?? {}) });
    response.end(typeof answer.body === "function" ? answer.body(origin) : (answer.body ?? ""));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run(origin);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

function cli(...args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { encoding: "utf8" }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, out: `${stdout}${stderr}` }));
  });
}

const WORDS = "Fresh bread baked every morning in the old town, with sourdough, rye and seeded loaves, pastries on Saturdays, and a small counter where you can order ahead for collection the next day.";
const GOOD_PAGE = `<!doctype html><html lang="en"><head>
<title>Corner Bakery</title>
<meta name="description" content="Fresh bread baked every morning.">
<link rel="canonical" href="https://bakery.example/">
<link rel="alternate" type="text/markdown" href="/index.md">
<script type="application/ld+json">{"@type":"Bakery","name":"Corner Bakery"}</script>
</head><body><header><nav><a href="/menu">Menu</a></nav></header>
<main><h1>Corner Bakery</h1><p>${WORDS}</p>
<img src="/loaf.jpg" alt="A sourdough loaf" width="400" height="300">
<form toolname="order_bread" tooldescription="Orders bread for collection tomorrow">
  <label for="loaf">Which loaf</label><input id="loaf" name="loaf" type="text" toolparamdescription="The loaf to order">
  <button type="submit">Order</button>
</form>
<button aria-label="Open the basket"><svg viewBox="0 0 1 1"></svg></button>
</main><footer><a href="/about"><img src="/logo.png" alt="About us" width="20" height="20"></a></footer></body></html>`;

const goodSite = {
  "/": (request) =>
    (request.headers.accept ?? "").includes("text/markdown")
      ? { type: "text/markdown; charset=utf-8", headers: { vary: "Accept" }, body: `# Corner Bakery\n\n${WORDS}\n` }
      : { type: "text/html; charset=utf-8", headers: { link: '</llms.txt>; rel="describedby"', vary: "Accept" }, body: GOOD_PAGE },
  "/menu": { body: GOOD_PAGE.replace("<h1>Corner Bakery</h1>", "<h1>Menu</h1>") },
  "/robots.txt": { type: "text/plain", body: (origin) => `User-agent: *\nAllow: /\nDisallow: /api/\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${origin}/sitemap.xml\n` },
  "/sitemap.xml": { type: "application/xml", body: (origin) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/menu</loc></url></urlset>` },
  "/llms.txt": { type: "text/plain", body: "# Corner Bakery\n\n> Fresh bread baked every morning.\n\n## Pages\n\n- [Menu](/menu): what we bake, and prices\n" },
  "/api/orders": (request, origin) => ({ status: 401, type: "application/json", headers: { "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` }, body: '{"error":"sign_in_needed"}' }),
  "/.well-known/oauth-protected-resource": { type: "application/json", body: (origin) => JSON.stringify({ resource: origin, authorization_servers: ["https://auth.bakery.example"], scopes_supported: ["orders:read"] }) },
};

// An app that sends the same empty page for every address, and fills it in with JavaScript.
const emptyShell = { "*": { body: '<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>' } };

const ids = (results, status) => results.filter((r) => r.status === status).map((r) => r.id);

test("a site built to the rules has nothing to fix and nothing to look at", async () => {
  await serve(goodSite, async (origin) => {
    const results = await checkSite(origin, { pages: ["/menu"], apis: ["/api/orders"] });
    assert.deepEqual(ids(results, "fail"), [], JSON.stringify(results, null, 2));
    assert.deepEqual(ids(results, "warn"), [], JSON.stringify(results, null, 2));
    for (const id of ["page-text", "page-heading", "page-names", "page-forms", "not-found", "robots", "robots-policy", "sitemap", "llms", "markdown", "link-header", "api", "well-known"]) assert.ok(ids(results, "ok").includes(id), `${id} should be OK`);
  });
});

test("an app that is empty until JavaScript runs fails where a crawler would", async () => {
  await serve(emptyShell, async (origin) => {
    const results = await checkSite(origin, { apis: ["/api/orders"] });
    const failed = ids(results, "fail");
    for (const id of ["page-text", "page-heading", "not-found", "robots", "sitemap", "llms", "api"]) assert.ok(failed.includes(id), `${id} should need fixing: ${failed}`);
    assert.match(results.find((r) => r.id === "page-text").detail, /empty app container/);
    assert.match(results.find((r) => r.id === "robots").title, /answers with a web page/);
    assert.match(results.find((r) => r.id === "llms").title, /answers with a web page/);
  });
});

test("--private leaves out the checks for public sites", async () => {
  await serve(emptyShell, async (origin) => {
    const results = await checkSite(origin, { isPublic: false });
    const all = results.map((r) => r.id);
    for (const id of ["page-text", "robots", "sitemap", "llms", "markdown", "link-header", "page-meta"]) assert.ok(!all.includes(id), `${id} is for public sites only`);
    assert.ok(all.includes("page-heading") && all.includes("not-found"), "the checks for every page still run");
  });
});

test("controls are counted as named or not the way a visiting agent would find them", () => {
  const page = readPage(`<html><head><title>T</title></head><body><main><h1>Shop</h1>
    <button><svg viewBox="0 0 1 1"><path d="M0 0"/></svg></button>
    <button aria-label="Close"><svg></svg></button>
    <button><svg><title>Search</title></svg></button>
    <button>Buy</button>
    <a href="/a"><img src="a.png" alt="Home"></a>
    <a href="/b"><i class="icon"></i></a>
    <a>Nowhere</a>
    <a id="top"></a>
    <img src="x.png">
    <img src="y.png" alt="" width="1" height="1">
    <input type="hidden" name="token">
    <input type="email" placeholder="Email">
    <label>Name <input type="text" name="name"></label>
    <label for="city">City</label><select id="city"><option>A</option></select>
    <textarea aria-label="Message"></textarea>
    <div role="button">Go</div><span onclick="go()">Go</span>
    <noscript><p>Please switch on JavaScript to use this shop today, thank you very much indeed.</p></noscript>
    <script>var words = "these words inside a script never count as text on the page";</script>
  </main></body></html>`);
  assert.equal(page.unnamedButtons, 1, "only the icon button with no label");
  assert.equal(page.unnamedLinks, 1, "the icon link; the image link takes its name from the alt text");
  assert.equal(page.deadLinks, 1, "a link without href, but not an anchor target");
  assert.equal(page.noAlt, 1);
  assert.equal(page.noSize, 2);
  assert.equal(page.fields, 4, "hidden fields are left out");
  assert.equal(page.unnamedFields, 1, "a placeholder is not a name");
  assert.equal(page.fakeButtons, 2);
  assert.equal(page.h1, 1);
  assert.ok(page.main);
  assert.ok(page.words < 15, `script and noscript text is not page text (${page.words} words)`);
});

test("an API route is judged by how it answers without a token", async () => {
  const routes = {
    ...goodSite,
    "/api/redirect": { status: 302, headers: { location: "/login" } },
    "/api/page": { status: 200, type: "text/html", body: "<h1>Sign in</h1>" },
    "/api/open": { status: 200, type: "application/json", body: "[]" },
    "/api/quiet": { status: 401, type: "application/json", body: '{"error":"sign_in_needed"}' },
    "/api/html-error": { status: 401, type: "text/html", body: "<h1>401</h1>" },
    "/api/lost": (request, origin) => ({ status: 401, type: "application/json", headers: { "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/nothing-here"` }, body: "{}" }),
  };
  await serve(routes, async (origin) => {
    const one = async (route) => (await checkSite(origin, { apis: [route], isPublic: false })).find((r) => r.id === "api");
    assert.equal((await one("/api/orders")).status, "ok");
    assert.match((await one("/api/redirect")).title, /redirects when there is no token \(302 to \/login\)/);
    assert.equal((await one("/api/redirect")).status, "fail");
    assert.equal((await one("/api/page")).status, "fail", "a web page with 200 looks like success to an agent");
    assert.equal((await one("/api/open")).status, "warn", "fine only if the route is meant to be public");
    assert.equal((await one("/api/quiet")).status, "warn", "a private API need not say where to sign in");
    assert.equal((await one("/api/html-error")).status, "fail");
    assert.equal((await one("/api/lost")).status, "fail", "it points at sign-in details that are not there");
    assert.equal((await one("/api/missing")).status, "fail");
    // Git Bash on Windows rewrites /api/orders before the script sees it.
    assert.equal((await one("C:/Program Files/Git/api/orders")).status, "ok");
  });
});

test("a Link header or a discovery file that is broken needs fixing", async () => {
  const routes = {
    ...goodSite,
    "/": { headers: { link: '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"' }, body: GOOD_PAGE },
    "/.well-known/mcp/server-card.json": { type: "application/json", body: '{"transport":"http"}' },
  };
  await serve(routes, async (origin) => {
    const results = await checkSite(origin);
    const link = results.find((r) => r.id === "link-header");
    assert.equal(link.status, "fail");
    assert.match(link.detail, /\/\.well-known\/api-catalog \(404\)/);
    assert.doesNotMatch(link.detail, /llms\.txt/, "the file that exists is not blamed");
    assert.ok(results.some((r) => r.id === "well-known" && r.status === "fail" && r.title.includes("server-card.json")));
    assert.equal(results.find((r) => r.id === "markdown").status, "warn", "this home page has no Markdown version");
  });
});

test("paths that Git Bash rewrote are put back", () => {
  assert.equal(sitePath("C:/Program Files/Git/api/items"), "/api/items");
  assert.equal(sitePath("C:\\Program Files\\Git\\docs\\start"), "/docs/start");
  assert.equal(sitePath("/pricing"), "/pricing");
  assert.equal(sitePath("https://example.com/pricing"), "https://example.com/pricing");
});

test("from the command line it prints plain lines, and exits 1 only when something needs fixing", async () => {
  await serve(goodSite, async (origin) => {
    const good = await cli(origin, "--page", "/menu", "--api", "/api/orders");
    assert.equal(good.code, 0, good.out);
    assert.match(good.out, /^OK {4}\/ sends its text in the first HTML/m);
    assert.match(good.out, /Web check: \d+ of \d+ OK\.\n/);
    const json = await cli(origin, "--json");
    assert.ok(JSON.parse(json.out).every((r) => r.status && r.id && r.title));
  });
  await serve(emptyShell, async (origin) => {
    const bad = await cli(origin);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /^FIX {3}\/ has almost no text in its first HTML/m);
    assert.match(bad.out, /Web check: \d+ of \d+ OK, \d+ to fix/);
  });
});

test("nothing running at the address is one clear line, and no address shows how to use it", async () => {
  const port = await serve({}, async (origin) => new URL(origin).port); // a port that was free a moment ago
  const down = await cli(`http://127.0.0.1:${port}`);
  assert.equal(down.code, 1);
  assert.match(down.out, /FIX {3}\/ could not be reached/);
  assert.equal(down.out.match(/^(OK|FIX|LOOK)/gm).length, 1, "no pile of follow-on failures");
  const none = await cli();
  assert.equal(none.code, 1);
  assert.match(none.out, /Give the site's address/);
  const odd = await checkSite("http://");
  assert.equal(odd[0].id, "address");
});
