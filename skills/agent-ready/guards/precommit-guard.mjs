#!/usr/bin/env node
// agent-ready pre-commit check
//
// Refuses a commit that adds a secret file (.env, private keys, service account
// files) or a line that looks like a real API key. Runs from a git pre-commit
// hook, so it protects you whether a human or an agent makes the commit.
//
//   node .agents/hooks/precommit-guard.mjs              check what is staged (the hook runs this)
//   node .agents/hooks/precommit-guard.mjs --scan-repo  check every tracked file, once, on an existing project
//   node .agents/hooks/precommit-guard.mjs --self-test  prove the patterns work
//
// A false alarm? The human (never an agent) can check it and run
// `git commit --no-verify` once. Better: move the value into .env and read it
// from there.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DECOY_FILE, isSecretPath } from "./guard.mjs";

// Values that are obviously not real secrets.
const PLACEHOLDER = /(your|example|sample|placeholder|changeme|change_me|dummy|fake|xxxx|\*\*\*|<|\$\{|process\.env|import\.meta\.env|os\.environ|getenv)/i;

const KEY_PATTERNS = [
  { name: "a private key", re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/ },
  { name: "an AWS access key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "a GitHub token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { name: "an OpenAI or Anthropic key", re: /\bsk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{32,}/ },
  { name: "a Stripe live key", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/ },
  { name: "a Stripe webhook secret", re: /\bwhsec_[A-Za-z0-9]{24,}/ },
  { name: "a Slack token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { name: "a Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "a Supabase secret key", re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "a SendGrid key", re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/ },
  {
    name: "a hardcoded secret",
    re: /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|secret|token|password|passwd|private[_-]?key|access[_-]?key)\b["']?\s*[:=]\s*["']([^"'\s]{16,})["']/i,
    keep: (match) => !PLACEHOLDER.test(match[1]),
  },
];

// Files that are never worth scanning line by line.
const SKIP_CONTENT = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|go\.sum)$|\.(min\.js|map|svg|png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf)$/i;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function mask(text) {
  return text.length <= 8 ? "****" : `${text.slice(0, 4)}****`;
}

export function findKeys(line) {
  const hits = [];
  for (const pattern of KEY_PATTERNS) {
    const match = line.match(pattern.re);
    if (match && (!pattern.keep || pattern.keep(match))) hits.push({ name: pattern.name, sample: mask(match[1] ?? match[0]) });
  }
  return hits;
}

function secretFileProblems(files) {
  return files
    .filter((file) => isSecretPath(file) || file.toLowerCase().endsWith(DECOY_FILE))
    .map((file) => `${file}: this file holds secrets and must never be committed.`);
}

function checkStaged() {
  const files = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]).split("\0").filter(Boolean);
  const problems = secretFileProblems(files);

  const diff = git(["diff", "--cached", "-U0", "--no-color", "--diff-filter=ACMR"]);
  let file = "";
  let lineNo = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.replace(/^\+\+\+ (b\/)?/, "");
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      lineNo = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+")) {
      if (!SKIP_CONTENT.test(file)) {
        for (const hit of findKeys(line.slice(1))) problems.push(`${file}:${lineNo}: looks like ${hit.name} (${hit.sample}).`);
      }
      lineNo++;
    }
  }
  return problems;
}

function scanRepo() {
  const files = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const problems = secretFileProblems(files);
  for (const file of files) {
    if (SKIP_CONTENT.test(file)) continue;
    let text;
    try {
      if (statSync(file).size > 1024 * 1024) continue;
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary
    text.split(/\r?\n/).forEach((line, index) => {
      for (const hit of findKeys(line)) problems.push(`${file}:${index + 1}: looks like ${hit.name} (${hit.sample}).`);
    });
  }
  return problems;
}

// Sample keys are built from pieces so this file never contains a real-looking key itself.
const SELF_TEST_LINES = [
  [`const key = "${"AKIA"}${"ABCDEFGHIJKLMNOP"}";`, true],
  [`STRIPE=${"sk_"}live_${"a1B2c3D4e5F6g7H8i9J0"}`, true],
  [`token: "${"ghp_"}${"x".repeat(36)}"`, true],
  [`OPENAI_API_KEY=${"sk-"}proj-${"Ab3".repeat(12)}`, true],
  [`-----BEGIN ${"RSA PRIVATE"} KEY-----`, true],
  [`const apiKey = "${"q8Lz2Vn4Rt6Yp0Wd"}${"Hs7Kc5Jm"}";`, true],
  [`const apiKey = "your-api-key-goes-here";`, false],
  [`const apiKey = process.env.OPENAI_API_KEY;`, false],
  [`password: "\${DB_PASSWORD}"`, false],
  [`const tokenCount = 1200;`, false],
  [`// read the secret from .env, never hardcode it`, false],
];

function runSelfTest() {
  let failures = 0;
  for (const [line, expectHit] of SELF_TEST_LINES) {
    const hit = findKeys(line).length > 0;
    if (hit !== expectHit) failures++;
    console.log(`${hit === expectHit ? "PASS" : "FAIL"}  ${expectHit ? "flag" : "allow"}  ${line.slice(0, 60)}`);
  }
  console.log(failures === 0 ? `\nAll ${SELF_TEST_LINES.length} checks passed.` : `\n${failures} of ${SELF_TEST_LINES.length} checks failed.`);
  return failures === 0 ? 0 : 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit(runSelfTest());

  const scan = args.includes("--scan-repo");
  let problems;
  try {
    problems = scan ? scanRepo() : checkStaged();
  } catch (error) {
    console.error(`agent-ready: could not run git (${error.message}). Is this a git repository?`);
    process.exit(1);
  }

  if (problems.length === 0) {
    if (scan) console.log("agent-ready: no secret files or real-looking keys found in tracked files.");
    process.exit(0);
  }

  console.error(scan ? "agent-ready found possible secrets in tracked files:\n" : "agent-ready stopped this commit:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    scan
      ? "\nAnything listed here is already in git history. Rotate those keys (make new ones and delete the old ones) and move the values into .env."
      : "\nMove secret values into .env (which git ignores) and read them from there.\n" +
          "If a file holds secrets, run: git rm --cached <file>\n" +
          "If this is a false alarm, a human can check it and commit with --no-verify. Agents must never do that.",
  );
  process.exit(1);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) main();
