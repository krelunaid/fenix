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
    assert.match(src, /hasActiveVisualJob/);
    assert.match(src, /visualJobPatch/);
    assert.match(src, /Idempotency-Key/);
    const resume = src.slice(
      src.indexOf("export async function resumePolish"),
      src.indexOf("export async function runBuild"),
    );
    assert.doesNotMatch(resume, /spendCredit/);
    assert.match(resume, /finishPolish/);
    assert.match(resume, /abandonVisualJob/);
    assert.match(resume, /if \(message === JOB_STILL_RUNNING\)/);
    assert.match(resume, /const live = Boolean\(hasActiveVisualJob/);
    assert.match(resume, /mergeUniqueLogs/);
    assert.match(src, /mergeUniqueLogs\(prev, job\.log\)/);
    assert.match(src, /if \(refund\) refundBuildCredit\(projectId, refund\)/);
    assert.match(src, /charged = !finishPolish/);
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
    const recover = readFileSync(join(root, "src/lib/projects/recover.ts"), "utf8");
    assert.match(recover, /STALE_BUILD_MS = 120_000/);
    assert.doesNotMatch(recover, /status = "ready"/);
    const store = readFileSync(join(root, "src/lib/projects/store.ts"), "utf8");
    assert.match(store, /resolveProjectKind/);
    assert.doesNotMatch(store, /existing\?\.kind \?\? result\.kind/);
    assert.match(store, /kind: ProjectKind = "app"/);
    assert.match(store, /recoverPersistedProject/);
    assert.match(store, /MAX_PROJECTS = 48/);
    const studio = readFileSync(join(root, "src/routes/studio.$projectId.tsx"), "utf8");
    assert.match(studio, /isPublishable/);
    assert.match(studio, /compact=\{Boolean\(project\.html\)\}/);
    assert.match(studio, /codePaneFiles/);
    assert.doesNotMatch(studio, /fenix2Files\(seedFiveScreens/);
    const overlay = readFileSync(join(root, "src/components/build-overlay.tsx"), "utf8");
    assert.match(overlay, /compact = false/);
    assert.match(overlay, /z-20/);
    assert.doesNotMatch(overlay, /z-12/);
    const worker = readFileSync(join(root, "workers/visual/server.mjs"), "utf8");
    assert.doesNotMatch(worker, /card bianche, panel scuro solo se serve un dato, CTA pillola blu/);
    assert.doesNotMatch(worker, /2 colori #1d1d1f \/ #0071e3/);
    assert.match(worker, /function looksDashboard/);
    assert.match(worker, /DASHBOARD_SYSTEM/);
    assert.match(worker, /kind=dashboard/);
    assert.match(worker, /function findReusableJob/);
    assert.match(worker, /activeByProject/);
    assert.match(worker, /idempotency-key/);
    assert.match(worker, /reused: true/);
    assert.match(worker, /function sanitizeIconPack/);
    assert.match(worker, /isAppleChromeSvg/);
    assert.match(worker, /CRAFT_TAB_ICONS/);
    assert.match(worker, /registro a righe/);
  });

  it("drops iOS template fallbacks from look, shell, types and cards", () => {
    const look = readFileSync(join(root, "src/lib/ai/look.ts"), "utf8");
    assert.doesNotMatch(look, /Stile iOS/);
    assert.doesNotMatch(look, /#f5f5f7 #1d1d1f accento #0071e3/);
    const shell = readFileSync(join(root, "src/lib/ai/app-shell.ts"), "utf8");
    assert.doesNotMatch(shell, /#f5f5f7/);
    assert.doesNotMatch(shell, /#0071e3/);
    assert.doesNotMatch(shell, /-apple-system/);
    const types = readFileSync(join(root, "src/lib/projects/types.ts"), "utf8");
    assert.doesNotMatch(types, /#f5f5f7/);
    assert.doesNotMatch(types, /#0071e3/);
    const card = readFileSync(join(root, "src/components/project-card.tsx"), "utf8");
    assert.doesNotMatch(card, /#f5f5f7/);
    const scheme = readFileSync(join(root, "src/lib/projects/color-scheme.ts"), "utf8");
    assert.doesNotMatch(scheme, /#f5f5f7/);
    assert.doesNotMatch(scheme, /#0071e3/);
    assert.match(scheme, /data-fenix-ready/);
    assert.match(scheme, /ready:\s*function/);
    assert.match(scheme, /data-fenix-desk/);
    assert.match(scheme, /fenix-boot-error/);
    assert.match(scheme, /unhandledrejection/);
    assert.match(scheme, /data-fenix-boot-error/);
    assert.match(look, /waitPreviewBoot/);
    assert.match(look, /rememberBootError/);
    const crud = readFileSync(join(root, "src/lib/projects/dashboard-crud.ts"), "utf8");
    assert.match(crud, /data-fenix-crud/);
    assert.match(crud, /b85c38/);
    const runBuild = readFileSync(join(root, "src/lib/ai/run-build.ts"), "utf8");
    assert.doesNotMatch(runBuild, /Fenix 2: Vite \+ React/);
    assert.match(runBuild, /BOOT_REPAIR_MAX = 2/);
    assert.match(runBuild, /repairBootFailures/);
    assert.match(runBuild, /waitPreviewBoot/);
    assert.doesNotMatch(runBuild, /JOB_STILL_RUNNING \|\| \/Riprendi rifinitura/);
    assert.match(runBuild, /if \(workerError === JOB_STILL_RUNNING\)/);
  });
});
