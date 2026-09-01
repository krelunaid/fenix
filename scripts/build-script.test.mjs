import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const netlify = readFileSync(join(root, "netlify.toml"), "utf8");

test("pnpm-only environments can run the production build without npm", () => {
  assert.equal(typeof pkg.scripts.build, "string");
  assert.doesNotMatch(pkg.scripts.build, /npm\s+run/);
  assert.match(pkg.scripts.build, /node scripts\/with-app-env\.mjs vite build/);
  assert.match(pkg.scripts.build, /node scripts\/copy-pglite-assets\.mjs/);
  assert.match(pkg.scripts.build, /node scripts\/sync-static-publish\.mjs/);
  assert.match(pkg.scripts.build, /node scripts\/migrate\.mjs/);
  assert.match(netlify, /node scripts\/migrate\.mjs/);
  assert.match(netlify, /node scripts\/sync-static-publish\.mjs/);
  assert.match(netlify, /publish = "dist"/);
  assert.doesNotMatch(netlify, /npm run db:migrate/);
});
