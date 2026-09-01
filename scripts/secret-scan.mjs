#!/usr/bin/env node
/**
 * Fail the build if a real secret looks committed. Env *names* are fine.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PATTERNS = [
  { name: "pem", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "xai", re: /\bxai-[A-Za-z0-9]{20,}\b/ },
  { name: "netlify-token", re: /\bnfp_[A-Za-z0-9]{20,}\b/ },
  { name: "google-key", re: /\bAIza[0-9A-Za-z\-_]{20,}\b/ },
];

const SKIP = [
  /node_modules/,
  /\.git\//,
  /^dist\//,
  /^\.output\//,
  /^screenshots\//,
  /secret-scan/,
  /\.test\./,
];

export function scanText(text, file = "stdin") {
  const hits = [];
  if (SKIP.some((r) => r.test(file))) return hits;
  for (const p of PATTERNS) {
    if (p.re.test(text)) hits.push({ file, kind: p.name });
  }
  return hits;
}

export function scanFiles(files, read = (f) => readFileSync(join(root, f), "utf8")) {
  const hits = [];
  for (const file of files) {
    if (SKIP.some((r) => r.test(file))) continue;
    let text = "";
    try {
      text = read(file);
    } catch {
      continue;
    }
    hits.push(...scanText(text, file));
  }
  return hits;
}

function listGitFiles(cwd = root) {
  return execFileSync("git", ["ls-files"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = listGitFiles();
  const hits = scanFiles(files);
  if (hits.length) {
    for (const h of hits) console.error(`[secret-scan] ${h.kind} in ${h.file}`);
    process.exit(1);
  }
  console.log(`[secret-scan] ok ${files.length} files`);
}
