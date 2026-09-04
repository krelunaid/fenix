import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  BUILD_CONTRACT_VERSION,
  BUILD_ROLES,
  CONTRACT_REPAIR_MAX,
  blocksPublish,
  criticBudget,
  evaluateContract,
  extractColorPair,
  filesFor,
  formatContractErrors,
  formatReceipt,
  parseContract,
  planContract,
  roleReceipt,
  contractInstruction,
  contractAllowsReady,
} from "./build-contract.ts";
import { loadContractFixtures } from "./contract-fixtures.ts";
import { FENIX_MODEL } from "./model.ts";
import { APP_SHELL_HTML } from "./app-shell.ts";
import { QUALITY_LEDGER, qualityLedgerOk } from "../projects/quality-ledger.ts";
import { formatPrefix } from "../projects/infer.ts";
import { fileLooksLikeSecret } from "../projects/files.ts";
import { validateProductHtml } from "../projects/validate-html.ts";
import { gateIncompleteHtml } from "../projects/fenix-adapter.ts";
import { DEFAULT_PALETTE } from "../projects/types.ts";
import { polishDashboardHtml } from "../projects/dashboard-crud.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ARTIFACT = join(here, "fixtures/contract-eval.json");

describe("BuildContract planner (deterministic, no LLM)", () => {
  it("locks kind from FORMATO and returns a typed v1 contract", () => {
    const dash = planContract(`${formatPrefix("dashboard")}Argilla Viva magazzino e ordini.`);
    assert.equal(dash.version, BUILD_CONTRACT_VERSION);
    assert.equal(dash.kind, "dashboard");
    assert.ok(dash.screens.length >= 3);
    assert.ok(dash.entities.some((e) => e.crud));
    assert.ok(dash.files.includes("index.html"));
    assert.equal(dash.files.includes("data/ordini.json"), false);
    assert.deepEqual(filesFor("dashboard", "gestionale magazzino"), ["index.html"]);
    assert.deepEqual(filesFor("dashboard", "Argilla Viva — magazzino e ordini"), ["index.html"]);
    assert.deepEqual(filesFor("dashboard", "dashboard ordini della bottega"), ["index.html"]);
    assert.deepEqual(filesFor("dashboard", "Kiln con ordini, dati mock e API locale"), [
      "index.html",
      "css/theme.css",
      "js/app.js",
      "data/ordini.json",
    ]);
    assert.equal(dash.visual.aa, true);
    assert.deepEqual([...dash.visual.viewports], ["D", "T", "M"]);
    assert.ok(parseContract(dash));
    assert.equal(parseContract({ ...dash, version: 2 }), null);
    assert.equal(parseContract({ kind: "nope", version: 1, screens: [] }), null);

    const app = planContract(`${formatPrefix("app")}Taccuino in tasca.`);
    assert.equal(app.kind, "app");
    assert.deepEqual(app.screens, ["home", "new", "list", "stats", "more"]);

    const site = planContract(`${formatPrefix("site")}Vetrina bottega.`);
    assert.equal(site.kind, "site");
    assert.ok(site.screens.length >= 4);
    assert.match(contractInstruction(dash), /kind=dashboard/);
    assert.match(contractInstruction(dash), /CONTRATTO DI BUILD/);
    assert.doesNotMatch(contractInstruction(dash), /ragion[oa]|chain-of-thought visibile/i);
  });

  it("receipts name grok-build-0.1 and never look like CoT", () => {
    assert.deepEqual([...BUILD_ROLES], ["planner", "visual", "builder", "critic", "repairer"]);
    const planner = roleReceipt({
      role: "planner",
      ok: true,
      checks: ["kind", "screens"],
      skipped: true,
      reason: "static",
      tokens: 0,
    });
    assert.equal(planner.model, FENIX_MODEL);
    assert.equal(planner.model, "grok-build-0.1");
    assert.match(formatReceipt(planner), /^Piano · 2 check$/);
    const skipped = roleReceipt({ role: "critic", ok: true, skipped: true, reason: "static-ok" });
    assert.equal(formatReceipt(skipped), "QA · saltato");
    assert.doesNotMatch(formatReceipt(skipped), /perché|think|reasoning/i);
    assert.equal(CONTRACT_REPAIR_MAX, 2);
  });
});

describe("deterministic evaluator on 6 distinct fixtures", () => {
  it("contract→output passes on operational, consumer, utility, game and editorial products", () => {
    const fixtures = loadContractFixtures();
    assert.equal(fixtures.length, 6);
    assert.deepEqual(
      fixtures.map((f) => f.id),
      [
        "gestionale-crud",
        "consumer-mobile",
        "dashboard-multifile",
        "utility-calculator",
        "interactive-game",
        "portfolio-contact",
      ],
    );
    const reports = fixtures.map((fix) => {
      const contract = planContract(fix.brief);
      const expectedKinds = {
        "gestionale-crud": "dashboard",
        "consumer-mobile": "app",
        "dashboard-multifile": "dashboard",
        "utility-calculator": "app",
        "interactive-game": "app",
        "portfolio-contact": "site",
      } as const;
      assert.equal(contract.kind, expectedKinds[fix.id]);
      const evaluation = evaluateContract({
        html: fix.html,
        files: fix.files,
        contract,
        brief: fix.brief,
      });
      const failed = evaluation.checks.filter((c) => c.blocking && !c.ok);
      assert.equal(
        evaluation.ok,
        true,
        `${fix.id}: ${failed.map((c) => `${c.id}: ${c.detail}`).join(" · ")}`,
      );
      const byId = Object.fromEntries(evaluation.checks.map((c) => [c.id, c]));
      assert.equal(byId.html?.ok, true, fix.id);
      assert.equal(byId.crud?.ok, true, fix.id);
      assert.equal(byId.security?.ok, true, fix.id);
      assert.equal(byId.files?.ok, true, fix.id);
      assert.equal(byId.aa?.ok, true, fix.id);
      assert.equal(byId.graphic?.ok, true, `${fix.id} graphic ${byId.graphic?.detail}`);
      return {
        id: fix.id,
        family: fix.family,
        kind: evaluation.kind,
        ok: evaluation.ok,
        checks: evaluation.checks.map((c) => ({ id: c.id, ok: c.ok, blocking: c.blocking })),
      };
    });
    const multi = fixtures.find((f) => f.id === "dashboard-multifile");
    assert.ok(multi?.files.some((f) => f.path === "data/ordini.json"));
    assert.ok(multi?.files.some((f) => f.path === "js/app.js"));
    assert.equal(
      multi?.files.some((f) => fileLooksLikeSecret(f.content, f.path)),
      false,
    );
    mkdirSync(dirname(ARTIFACT), { recursive: true });
    writeFileSync(ARTIFACT, `${JSON.stringify({ model: FENIX_MODEL, reports }, null, 2)}\n`);
  });

  it("rejects secret, eval, phone chrome on dashboard, cheap iOS", () => {
    const contract = planContract(`${formatPrefix("dashboard")}Magazzino.`);
    const secret = evaluateContract({
      html: APP_SHELL_HTML,
      files: [
        { path: "index.html", content: APP_SHELL_HTML },
        { path: "secrets.txt", content: "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----" },
      ],
      contract,
      kind: "dashboard",
    });
    assert.equal(secret.ok, false);
    assert.ok(secret.checks.some((c) => c.id === "files" && !c.ok) || secret.checks.some((c) => c.id === "security" && !c.ok) || secret.checks.some((c) => c.id === "html" && !c.ok));

    const phoneOnDesk = evaluateContract({
      html: APP_SHELL_HTML,
      files: [{ path: "index.html", content: APP_SHELL_HTML }],
      contract,
      kind: "dashboard",
    });
    assert.equal(phoneOnDesk.ok, false);
    assert.ok(phoneOnDesk.checks.some((c) => c.id === "html" && !c.ok));

    const evalHtml = `<!DOCTYPE html><html><body>
<nav></nav><section></section><section></section><section></section><section></section>
<script>eval("1+1"); window.Fenix.load("s"); window.Fenix.save("s", {});</script>
</body></html>`;
    const evil = evaluateContract({
      html: evalHtml,
      contract: planContract(`${formatPrefix("site")}Vetrina.`),
      kind: "site",
    });
    assert.equal(evil.checks.find((c) => c.id === "security")?.ok, false);

    const cheap = `<!DOCTYPE html><html><head><style>:root{--bg:#f5f5f7;--fg:#1d1d1f;--accent:#0071e3}</style>
<link href="https://fonts.googleapis.com/css2?family=Manrope" rel="stylesheet"/></head>
<body><nav></nav><section></section><section></section><section></section><section></section>
<script>window.Fenix.load("s"); window.Fenix.save("s",{});</script></body></html>`;
    const ios = evaluateContract({
      html: cheap,
      contract: planContract(`${formatPrefix("site")}Landing.`),
      kind: "site",
    });
    assert.equal(ios.ok, false);
    assert.ok(ios.checks.some((c) => c.id === "visual-dna" && !c.ok) || ios.checks.some((c) => c.id === "html" && !c.ok));
  });

  it("skips critic LLM; graphic QA is blocking and not skippable", () => {
    const fixtures = loadContractFixtures();
    const mobile = fixtures[1]!;
    const evaluation = evaluateContract({
      html: mobile.html,
      files: mobile.files,
      contract: planContract(mobile.brief),
      brief: mobile.brief,
    });
    assert.equal(evaluation.ok, true);
    assert.equal(evaluation.checks.find((c) => c.id === "graphic")?.ok, true);
    assert.deepEqual(criticBudget({ kind: "app", evaluation }), { call: false, reason: "static-ok" });
    assert.deepEqual(criticBudget({ kind: "dashboard", evaluation: { ...evaluation, ok: false } }), {
      call: false,
      reason: "desk",
    });
    assert.deepEqual(criticBudget({ kind: "app", shot: true, evaluation: { ...evaluation, ok: false } }), {
      call: true,
      reason: "incomplete",
    });
    assert.deepEqual(
      criticBudget({ kind: "app", instruction: "sposta il bottone", evaluation: { ...evaluation, ok: false } }),
      { call: false, reason: "iterate" },
    );
    assert.deepEqual(criticBudget({ kind: "app", evaluation: { ...evaluation, ok: false } }), {
      call: true,
      reason: "incomplete",
    });
  });
});

const SITE_OK = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Vetrina</title>
<style>
:root{--bg:#1a1410;--fg:#f4efe8}
body{background:var(--bg);color:var(--fg);font-family:Georgia,serif}
:focus-visible{outline:2px solid #f4efe8}
button,a,input{min-height:44px;min-width:44px}
</style></head><body>
<nav><a href="#a">A</a><a href="#b">B</a><a href="#c">C</a><a href="#d">D</a></nav>
<section id="a"><h1>Home</h1></section>
<section id="b"><h2>Lavori</h2></section>
<section id="c"><h2>Visita</h2></section>
<section id="d"><h2>Contatto</h2>
<form><label>Nome<input name="n"/></label><button type="submit">Invia</button></form>
</section>
<script>
window.Fenix.load("s");
window.Fenix.save("s", {});
</script></body></html>`;

function stubResult(html: string, kind: "site" | "dashboard" | "app" = "site", files: { path: string; content: string }[] = []) {
  return {
    name: "Prova",
    tagline: "",
    kind,
    summary: "",
    direction: "",
    palette: DEFAULT_PALETTE,
    html,
    files: files.length ? files : [{ path: "index.html", content: html }],
  };
}

describe("false-positive gates closed", () => {
  it("AA fail-closed: missing palette or #777 on #777 is not ok", () => {
    const contract = planContract(`${formatPrefix("site")}Vetrina.`);
    const noPalette = SITE_OK.replace(/:root\{--bg:#1a1410;--fg:#f4efe8\}/, "");
    const missing = evaluateContract({ html: noPalette, contract, kind: "site" });
    assert.equal(extractColorPair(noPalette), null);
    assert.equal(missing.checks.find((c) => c.id === "aa")?.ok, false);
    assert.match(missing.checks.find((c) => c.id === "aa")?.detail || "", /non misurabile/);
    assert.equal(missing.ok, false);

    const gray = SITE_OK
      .replace(/:root\{--bg:#1a1410;--fg:#f4efe8\}/, "")
      .replace("body{background:var(--bg);color:var(--fg);font-family:Georgia,serif}", "body{background:#777;color:#777;font-family:Georgia,serif}");
    const pair = extractColorPair(gray);
    assert.ok(pair);
    assert.equal(pair?.bg, "#777777");
    const washed = evaluateContract({ html: gray, contract, kind: "site" });
    assert.equal(washed.checks.find((c) => c.id === "aa")?.ok, false);
    assert.equal(washed.ok, false);

    const laterWash = SITE_OK.replace(
      "body{background:var(--bg);color:var(--fg);font-family:Georgia,serif}",
      "body{background:#0e0d0b;color:#e8e0d0;font-family:Georgia,serif}\nbody{background:#777;color:#777}",
    );
    const laterPair = extractColorPair(laterWash);
    assert.equal(laterPair?.bg, "#777777");
    assert.equal(laterPair?.fg, "#777777");
    const later = evaluateContract({ html: laterWash, contract, kind: "site" });
    assert.equal(later.checks.find((c) => c.id === "aa")?.ok, false);
    assert.equal(later.ok, false);
  });

  it("file-tree: requested runtime files are all required and execute as one artifact", () => {
    const brief = `${formatPrefix("dashboard")}Kiln con ordini, dati mock e API locale.`;
    const contract = planContract(brief);
    assert.deepEqual(contract.files, [
      "index.html",
      "css/theme.css",
      "js/app.js",
      "data/ordini.json",
    ]);
    const html = loadContractFixtures()[0]!.html;
    const missing = evaluateContract({
      html,
      files: [{ path: "index.html", content: html }],
      contract,
      kind: "dashboard",
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.checks.find((c) => c.id === "files")?.ok, false);
    assert.match(missing.checks.find((c) => c.id === "files")?.detail || "", /ordini\.json/);

    const multi = loadContractFixtures().find((f) => f.id === "dashboard-multifile")!;
    const present = evaluateContract({
      html: multi.html,
      files: multi.files,
      contract: planContract(multi.brief),
      kind: "dashboard",
    });
    assert.equal(present.ok, true, formatContractErrors(present));
    assert.equal(present.checks.find((c) => c.id === "files")?.ok, true);
    assert.ok(multi.files.some((f) => f.path === "js/app.js"));
    assert.deepEqual(filesFor("dashboard", "Argilla Viva — magazzino e ordini."), ["index.html"]);
  });

  it("eval/secret/missing CRUD pass validateProductHtml then stay blocked by gate", async () => {
    const evalHtml = SITE_OK.replace(
      "window.Fenix.save(\"s\", {});",
      'eval("1+1"); window.Fenix.save("s", {});',
    );
    const htmlReport = validateProductHtml(evalHtml, { kind: "site" });
    assert.equal(htmlReport.ok, true, htmlReport.errors.join(" · "));
    const evalEval = evaluateContract({
      html: evalHtml,
      contract: planContract(`${formatPrefix("site")}Vetrina.`),
      kind: "site",
    });
    assert.equal(evalEval.ok, false);
    assert.equal(evalEval.checks.find((c) => c.id === "security")?.ok, false);
    assert.equal(contractAllowsReady(evalEval), false);
    assert.match(blocksPublish(evalHtml, "site"), /eval|security/);

    const gatedEval = await gateIncompleteHtml({
      prompt: `${formatPrefix("site")}Vetrina bottega.`,
      result: stubResult(evalHtml, "site"),
    });
    assert.equal("error" in gatedEval, true);
    assert.match((gatedEval as { error: string }).error, /eval|security|completo/i);

    const secretFiles = [
      { path: "index.html", content: SITE_OK },
      { path: "secrets.txt", content: "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----" },
    ];
    assert.equal(validateProductHtml(SITE_OK, { kind: "site" }).ok, true);
    const secretEval = evaluateContract({
      html: SITE_OK,
      files: secretFiles,
      contract: planContract(`${formatPrefix("site")}Vetrina.`),
      kind: "site",
    });
    assert.equal(secretEval.ok, false);
    const gatedSecret = await gateIncompleteHtml({
      prompt: `${formatPrefix("site")}Vetrina.`,
      result: stubResult(SITE_OK, "site", secretFiles),
    });
    assert.equal("error" in gatedSecret, true);

    const noCrud = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"/><title>Desk</title>
<style>:root{--bg:#0e0d0b;--fg:#e8e0d0}body{background:var(--bg);color:var(--fg);font-family:Georgia,serif}</style>
</head><body>
<button data-view="elenco">Elenco</button>
<button data-view="nuovo">Nuovo</button>
<button data-view="numeri">Numeri</button>
<section data-view="elenco"><h1>Elenco</h1></section>
<section data-view="nuovo"><h2>Nuovo</h2></section>
<section data-view="numeri"><h2>Numeri</h2></section>
<script>window.Fenix.load("s"); window.Fenix.save("s", {});</script>
</body></html>`;
    const crudHtml = validateProductHtml(noCrud, { kind: "dashboard" });
    assert.equal(crudHtml.ok, true, crudHtml.errors.join(" · "));
    const crudEval = evaluateContract({
      html: noCrud,
      contract: planContract(`${formatPrefix("dashboard")}Magazzino.`),
      kind: "dashboard",
    });
    assert.equal(crudEval.checks.find((c) => c.id === "crud")?.ok, false);
    assert.equal(crudEval.ok, false);
    const gatedCrud = await gateIncompleteHtml({
      prompt: `${formatPrefix("dashboard")}Magazzino pezzi.`,
      result: stubResult(noCrud, "dashboard"),
    });
    assert.equal("error" in gatedCrud, true);
    assert.match((gatedCrud as { error: string }).error, /crud|Fenix|completo/i);

    const argilla = readFileSync(join(here, "../projects/fixtures/argilla-viva.html"), "utf8");
    const polished = polishDashboardHtml(argilla, "dashboard");
    const argillaPrompt = "FORMATO: gestionale ufficio. kind=dashboard. Argilla Viva — magazzino e ordini.";
    assert.deepEqual(planContract(argillaPrompt).files, ["index.html"]);
    assert.equal(blocksPublish(polished, "dashboard", undefined, argillaPrompt), "");
    const kiln = loadContractFixtures()[0]!;
    assert.equal(blocksPublish(kiln.html, "dashboard", kiln.files, argillaPrompt), "");
  });
});

describe("quality ledger cites tests, not parity", () => {
  it("every row has evidence and none claim Emergent parity", () => {
    assert.equal(qualityLedgerOk(), true);
    assert.ok(QUALITY_LEDGER.length >= 8);
    for (const row of QUALITY_LEDGER) {
      assert.ok(row.evidence.length > 8, row.id);
      assert.doesNotMatch(row.claim, /parit[aà]|feature-complete|uguale a Emergent/i);
      assert.doesNotMatch(row.evidence, /parit[aà]|feature-complete/i);
    }
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "eval-crud"));
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "budget"));
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "browser-dtm"));
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "files-tree"));
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "aa-fail-closed"));
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "data-api-local-first"));
    assert.ok(QUALITY_LEDGER.some((r) => r.id === "intent-preservation"));
  });
});
