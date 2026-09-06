import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { composeProduct } from "../ai/compose-product.ts";
import { formatPrefix } from "./infer.ts";
import {
  INTERRUPT_ERROR,
  STALE_BUILD_MS,
  recoverPersistedProject,
  shouldResumePolish,
  shouldStartCreateBuild,
} from "./recover.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BARBER = `${formatPrefix("app")}App barbiere: agenda tagli e clienti, stile iPhone.`;

describe("interrupted generation resilience", () => {
  it("keeps a fresh barber compose seed building so preview is not Interrotto", () => {
    const composed = composeProduct(BARBER);
    assert.match(composed.html, /Prenota|forbici|shears|barber/i);
    const recovered = recoverPersistedProject({
      id: "barber-live",
      status: "building" as const,
      html: composed.html,
      kind: "app" as const,
      prompt: BARBER,
      error: undefined,
      updatedAt: Date.now(),
    });
    assert.equal(recovered.status, "building");
    assert.equal(recovered.error, undefined);
    assert.equal(shouldStartCreateBuild(recovered), true);
    assert.equal(shouldResumePolish(recovered), false);
    assert.doesNotMatch(recovered.error || "", /Interrotto/);
  });

  it("does not Interrotto a just-created empty studio before runBuild seeds it", () => {
    const recovered = recoverPersistedProject({
      id: "empty-create",
      status: "building",
      html: "",
      kind: "app",
      prompt: BARBER,
      updatedAt: Date.now(),
    });
    assert.equal(recovered.status, "building");
    assert.equal(shouldStartCreateBuild(recovered), true);
  });

  it("Interrotto only after a started create lost its HTML or went stale", () => {
    const abandoned = recoverPersistedProject({
      id: "abandoned",
      status: "building" as const,
      html: "",
      kind: "app" as const,
      buildEpoch: 1,
      error: undefined,
      updatedAt: Date.now(),
    });
    assert.equal(abandoned.status, "error");
    assert.equal(abandoned.error, INTERRUPT_ERROR);
    const stale = recoverPersistedProject({
      id: "stale-empty",
      status: "building" as const,
      html: "",
      kind: "app" as const,
      error: undefined,
      updatedAt: Date.now() - STALE_BUILD_MS - 1,
    });
    assert.equal(stale.status, "error");
    assert.equal(stale.error, INTERRUPT_ERROR);
  });

  it("routes composed phone creates to the worker and seeds HTML before the POST", () => {
    const runBuild = readFileSync(join(root, "lib/ai/run-build.ts"), "utf8");
    assert.match(runBuild, /function persistComposedSeed/);
    assert.match(runBuild, /WORKER_START_MS = 30_000/);
    assert.match(runBuild, /STREAM_WAIT_MS = 180_000/);
    assert.match(runBuild, /isIOS\(\) \|\| desk \|\| composedCreate/);
    assert.match(runBuild, /Resta la bozza composta/);
    const home = readFileSync(join(root, "routes/index.tsx"), "utf8");
    assert.match(home, /if \(!hydrated\) return;/);
    const edge = readFileSync(join(root, "../netlify/edge-functions/build.ts"), "utf8");
    assert.match(edge, /if \(composed && result\) \{\s*finish\(\{ t: "ok", result \}\);/s);
  });
});
