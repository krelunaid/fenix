import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("focus-visible and worker model", () => {
  it("declares :focus-visible on interactive chrome", () => {
    const css = readFileSync(join(root, "src/styles.css"), "utf8");
    assert.match(css, /:focus-visible/);
    assert.match(css, /a:focus-visible/);
    assert.match(css, /button:focus-visible/);
  });

  it("caps worker polish polls so overlay cannot last ~24 minutes", () => {
    const src = readFileSync(join(root, "src/lib/ai/run-build.ts"), "utf8");
    assert.match(src, /WORKER_POLL_MAX = 30/);
    assert.doesNotMatch(src, /for \(let i = 0; i < 240;/);
    assert.match(src, /export async function resumePolish/);
  });

  it("uses grok-build-0.1 on the visual worker with no reasoningEffort", () => {
    const worker = readFileSync(join(root, "workers/visual/server.mjs"), "utf8");
    assert.match(worker, /MODEL = "grok-build-0.1"/);
    assert.doesNotMatch(worker, /grok-4\.6/);
    assert.doesNotMatch(worker, /reasoning_effort\s*:/);
    assert.doesNotMatch(worker, /reasoningEffort\s*:/);
    const model = readFileSync(join(root, "src/lib/ai/model.ts"), "utf8");
    assert.match(model, /FENIX_MODEL = "grok-build-0.1"/);
    const edge = readFileSync(join(root, "netlify/edge-functions/build.ts"), "utf8");
    assert.match(edge, /MODEL = "grok-build-0.1"/);
    assert.doesNotMatch(edge, /reasoning_effort/);
  });

  it("does not iframe invalid or error projects on the home cards", () => {
    const card = readFileSync(join(root, "src/components/project-card.tsx"), "utf8");
    assert.match(card, /status === "error"/);
    assert.match(card, /validatePublishable/);
    assert.match(card, /report\?\.syntaxOk/);
    const store = readFileSync(join(root, "src/lib/projects/store.ts"), "utf8");
    assert.match(store, /const kind = existing\?\.kind \?\? result\.kind/);
    assert.match(store, /STALE_BUILD_MS = 120_000/);
    assert.match(store, /MAX_PROJECTS = 48/);
  });
});
