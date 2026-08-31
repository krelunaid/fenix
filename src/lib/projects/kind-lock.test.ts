import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { APP_SHELL_HTML } from "../ai/app-shell.ts";
import { DEMOS } from "./demos.ts";
import { codePaneFiles } from "./fenix2.ts";
import {
  formatPrefix,
  kindFromPrompt,
  resolveProjectKind,
} from "./infer.ts";
import {
  needsResume,
  recoverPersistedProject,
  RESUME_ERROR,
  STALE_BUILD_MS,
  type Recoverable,
} from "./recover.ts";
import { DEFAULT_PALETTE } from "./types.ts";
import { validateProductHtml } from "./validate-html.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ARGILLA_PROMPT =
  "FORMATO: gestionale ufficio. kind=dashboard. Desktop: elenco, filtri, form nuovo, numeri. Tabella che si riempie. NON landing, NON tabbar iPhone.\n\nArgilla Viva — magazzino e ordini.";

describe("kindFromPrompt / resolveProjectKind", () => {
  it("reads kind=dashboard and FORMATO gestionale from the stored prompt", () => {
    assert.equal(kindFromPrompt(ARGILLA_PROMPT), "dashboard");
    assert.equal(kindFromPrompt(formatPrefix("dashboard") + "un magazzino"), "dashboard");
    assert.equal(kindFromPrompt(formatPrefix("site") + "una vetrina"), "site");
    assert.match(formatPrefix("site"), /NON un gestionale/);
    assert.match(formatPrefix("site"), /orders/);
    assert.equal(kindFromPrompt(formatPrefix("app") + "un'officina"), "app");
    assert.equal(kindFromPrompt("un brief senza formato"), undefined);
  });

  it("lets an explicit prompt kind beat a historically wrong stored site", () => {
    assert.equal(
      resolveProjectKind({
        stored: "site",
        prompt: ARGILLA_PROMPT,
        worker: "site",
      }),
      "dashboard",
    );
  });

  it("never lets a worker META overwrite a user-chosen kind", () => {
    assert.equal(
      resolveProjectKind({
        stored: "dashboard",
        requested: "dashboard",
        prompt: ARGILLA_PROMPT,
        worker: "site",
      }),
      "dashboard",
    );
    assert.equal(
      resolveProjectKind({
        stored: "app",
        requested: "app",
        prompt: formatPrefix("app") + "officina",
        worker: "site",
      }),
      "app",
    );
    assert.equal(
      resolveProjectKind({
        stored: "site",
        requested: "site",
        prompt: formatPrefix("site") + "vetrina",
        worker: "dashboard",
      }),
      "site",
    );
  });
});

describe("recover persisted site + prompt kind=dashboard", () => {
  it("migrates to dashboard, asks for Riprendi, and resume spends no credits", () => {
    const persisted: Recoverable = {
      id: "argilla-viva",
      status: "building",
      html: APP_SHELL_HTML,
      kind: "site",
      prompt: ARGILLA_PROMPT,
      updatedAt: Date.now() - STALE_BUILD_MS - 1_000,
      palette: DEFAULT_PALETTE,
    };
    const recovered = recoverPersistedProject(persisted);
    assert.equal(recovered.kind, "dashboard");
    assert.equal(recovered.requestedKind, "dashboard");
    assert.equal(recovered.status, "error");
    assert.equal(recovered.error, RESUME_ERROR);
    assert.equal(needsResume(recovered), true);

    const readyWrong = recoverPersistedProject({
      ...persisted,
      id: "argilla-viva-ready",
      status: "ready",
      updatedAt: Date.now(),
    });
    assert.equal(readyWrong.kind, "dashboard");
    assert.equal(readyWrong.status, "error");
    assert.equal(readyWrong.error, RESUME_ERROR);
    assert.equal(needsResume(readyWrong), true);

    const src = readFileSync(join(root, "src/lib/ai/run-build.ts"), "utf8");
    const resume = src.slice(
      src.indexOf("export async function resumePolish"),
      src.indexOf("export async function runBuild"),
    );
    assert.doesNotMatch(resume, /spendCredit/);
    assert.match(resume, /resolveProjectKind/);
    assert.match(resume, /DASHBOARD_POLISH_INSTRUCTION/);
    assert.match(resume, /finishPolish/);
    assert.match(resume, /abandonVisualJob/);
    assert.match(resume, /const live = Boolean\(hasActiveVisualJob/);
    assert.match(resume, /uniqueLogs/);
    assert.match(resume, /repairBootFailures/);
    assert.match(src, /visualJobId/);
    assert.match(src, /hasActiveVisualJob/);
    assert.match(src, /Idempotency-Key/);
    assert.match(src, /startPolishJob/);
  });

  it("keeps kiln publishable as dashboard after recover", () => {
    const recovered = recoverPersistedProject({
      id: "kiln",
      status: "ready",
      html: DEMOS.kiln.html,
      kind: "dashboard",
      prompt: formatPrefix("dashboard") + "forno",
      updatedAt: Date.now(),
      palette: DEMOS.kiln.palette,
    });
    assert.equal(recovered.status, "ready");
    assert.equal(recovered.kind, "dashboard");
  });
});

describe("dashboard parse and code pane", () => {
  it("locks parseBuildOutput to the requested kind and skips the 5-tab React seed", () => {
    const src = readFileSync(join(root, "src/lib/ai/parse.ts"), "utf8");
    assert.match(src, /export function parseBuildOutput\(text: string, lockKind\?: ProjectKind\)/);
    assert.match(src, /if \(lockKind\) meta.kind = lockKind/);
    assert.match(src, /isPhoneKind\(meta.kind\)/);
    assert.match(src, /kind: "app"/);
    assert.doesNotMatch(src, /kind: "site"/);
  });

  it("shows index.html in the code pane for dashboard, not the generic 5-tab App", () => {
    const fakeReact = [
      { path: "index.html", content: "<!doctype html><div id=root></div>" },
      { path: "src/App.tsx", content: "export default function App(){return null}" },
    ];
    const files = codePaneFiles(DEMOS.kiln.html, fakeReact, {
      name: "Kiln",
      palette: DEMOS.kiln.palette,
      kind: "dashboard",
    });
    assert.equal(files.some((f) => f.path === "src/App.tsx"), false);
    assert.equal(files.length, 1);
    assert.equal(files[0]?.path, "index.html");
    assert.match(files[0]?.content ?? "", /Kiln/);
  });
});

describe("dashboard html gate", () => {
  it("rejects a phone fk-tab shell and keeps kiln valid", () => {
    const phone = validateProductHtml(APP_SHELL_HTML, { kind: "dashboard" });
    assert.equal(phone.ok, false);
    assert.ok(phone.errors.some((e) => /tabbar telefono|fk-tab/i.test(e)));
    const kiln = validateProductHtml(DEMOS.kiln.html, { kind: "dashboard" });
    assert.equal(kiln.ok, true, kiln.errors.join(" · "));
    const asApp = validateProductHtml(APP_SHELL_HTML, { kind: "app" });
    assert.equal(asApp.ok, true, asApp.errors.join(" · "));
  });
});
