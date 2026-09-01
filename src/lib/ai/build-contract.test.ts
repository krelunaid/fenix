import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  BUILD_CONTRACT_VERSION,
  BUILD_ROLES,
  CONTRACT_REPAIR_MAX,
  criticBudget,
  evaluateContract,
  formatReceipt,
  parseContract,
  planContract,
  roleReceipt,
  contractInstruction,
} from "./build-contract.ts";
import { loadContractFixtures } from "./contract-fixtures.ts";
import { FENIX_MODEL } from "./model.ts";
import { APP_SHELL_HTML } from "./app-shell.ts";
import { QUALITY_LEDGER, qualityLedgerOk } from "../projects/quality-ledger.ts";
import { formatPrefix } from "../projects/infer.ts";
import { fileLooksLikeSecret } from "../projects/files.ts";

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

describe("deterministic evaluator on 3 distinct fixtures", () => {
  it("contract→output passes on gestionale, mobile, dashboard multi-file", () => {
    const fixtures = loadContractFixtures();
    assert.equal(fixtures.length, 3);
    assert.deepEqual(
      fixtures.map((f) => f.id),
      ["gestionale-crud", "consumer-mobile", "dashboard-multifile"],
    );
    const reports = fixtures.map((fix) => {
      const contract = planContract(fix.brief);
      assert.equal(contract.kind, fix.id === "consumer-mobile" ? "app" : "dashboard");
      const evaluation = evaluateContract({
        html: fix.html,
        files: fix.files,
        contract,
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
    assert.ok(multi?.files.some((f) => f.path === "api/mock.js"));
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

  it("skips critic LLM when static gates pass", () => {
    const fixtures = loadContractFixtures();
    const mobile = fixtures[1]!;
    const evaluation = evaluateContract({
      html: mobile.html,
      files: mobile.files,
      contract: planContract(mobile.brief),
    });
    assert.equal(evaluation.ok, true);
    assert.deepEqual(criticBudget({ kind: "app", evaluation }), { call: false, reason: "static-ok" });
    assert.deepEqual(criticBudget({ kind: "dashboard", evaluation: { ...evaluation, ok: false } }), {
      call: false,
      reason: "desk",
    });
    assert.deepEqual(criticBudget({ kind: "app", shot: true, evaluation: { ...evaluation, ok: false } }), {
      call: false,
      reason: "screenshot",
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
  });
});
