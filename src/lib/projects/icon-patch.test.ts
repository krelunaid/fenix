import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  AGENDA_CALENDAR_SVG,
  AGENDA_ICON_INSTRUCTION,
  ICON_DELTA_BUDGET,
  ICON_HTML_BOUND,
  applyIconPatch,
  applyIconRevision,
  looksLikeIconInstruction,
  refundIconFailure,
  resolveIconTarget,
  snapshotStructure,
  structuralDrift,
} from "../../../workers/visual/icon-patch.mjs";
import { evaluateContract, planContract, blocksPublish } from "../ai/build-contract.ts";
import { formatPrefix } from "./infer.ts";
import { isPublishable } from "./recover.ts";
import { leakedRuntimeText } from "./graphic-quality.ts";
import { isStudioLocked } from "./studio-lock.ts";

const here = dirname(fileURLToPath(import.meta.url));
const AGENDA = readFileSync(join(here, "fixtures/agenda.html"), "utf8");
const BROKEN = readFileSync(join(here, "fixtures/agenda-broken.html"), "utf8");
const BRIEF = `${formatPrefix("app")}Agenda studio: impegni e appuntamenti in tasca.`;

function innerSvg(html: string, id: string) {
  const i = html.indexOf(`data-fenix-id="${id}"`);
  if (i < 0) return "";
  const slice = html.slice(i, i + 900);
  return slice.match(/<svg[\s\S]*?<\/svg>/i)?.[0] || "";
}

describe("atomic icon patch", () => {
  it("classifies pointed icon requests and refuses full rewrites", () => {
    assert.equal(looksLikeIconInstruction(AGENDA_ICON_INSTRUCTION), true);
    assert.equal(looksLikeIconInstruction("Cambia solo l'icona della tab Prenota"), true);
    assert.equal(looksLikeIconInstruction("Cambia le icone delle tab"), false);
    assert.equal(looksLikeIconInstruction("Rifai tutta l'app e l'icona"), false);
    assert.equal(looksLikeIconInstruction("Sistema il form di Prenota"), false);
    assert.ok(ICON_DELTA_BUDGET <= 8192);
    assert.ok(ICON_HTML_BOUND >= 80_000);
  });

  it("patches one owned icon and keeps files/views/CRUD byte-stable", () => {
    const extra = {
      path: "src/screens/Home.tsx",
      content: "export default function Home(){return null}",
    };
    const files = [
      { path: "index.html", content: AGENDA },
      extra,
    ];
    const target = resolveIconTarget(AGENDA, AGENDA_ICON_INSTRUCTION);
    assert.equal(target.status, "ok");
    assert.equal(target.id, "icon:home");
    const verdict = applyIconRevision({
      html: AGENDA,
      files,
      instruction: AGENDA_ICON_INSTRUCTION,
    });
    assert.equal(verdict.status, "ok", verdict.reason);
    assert.equal(verdict.spent, true);
    assert.equal(verdict.refund, false);
    assert.notEqual(innerSvg(verdict.html, "icon:home"), innerSvg(AGENDA, "icon:home"));
    assert.match(innerSvg(verdict.html, "icon:home"), /M8 4v4M16 4v4/);
    assert.equal(innerSvg(verdict.html, "icon:new"), innerSvg(AGENDA, "icon:new"));
    assert.equal(innerSvg(verdict.html, "icon:list"), innerSvg(AGENDA, "icon:list"));
    assert.equal(innerSvg(verdict.html, "icon:stats"), innerSvg(AGENDA, "icon:stats"));
    assert.equal(innerSvg(verdict.html, "icon:more"), innerSvg(AGENDA, "icon:more"));
    assert.equal(innerSvg(verdict.html, "icon:app"), innerSvg(AGENDA, "icon:app"));
    assert.equal(
      verdict.files.find((f: { path: string }) => f.path === extra.path)?.content,
      extra.content,
    );
    const drift = structuralDrift(snapshotStructure(AGENDA, files), snapshotStructure(verdict.html, verdict.files));
    assert.equal(drift, "");
    assert.match(verdict.html, /Fenix\.data\.query\("impegni"\)/);
    assert.match(verdict.html, /data-view="home"/);
    assert.match(verdict.html, /data-view="new"/);
    assert.match(verdict.html, /data-view="list"/);
    assert.match(verdict.html, /data-view="stats"/);
    assert.match(verdict.html, /data-view="more"/);
    assert.equal(isStudioLocked({ status: "building" }), true);
  });

  it("fails absent and ambiguous targets without spending", () => {
    const noHome = AGENDA.replace(/data-fenix-id="icon:home"/g, "").replace(/data-view="home"/g, 'data-view="ghost"');
    const absent = applyIconRevision({
      html: noHome,
      instruction: AGENDA_ICON_INSTRUCTION,
    });
    assert.equal(absent.status, "absent");
    assert.equal(absent.spent, false);
    assert.equal(absent.refund, false);
    assert.equal(absent.html, noHome);
    assert.match(absent.reason, /assente/i);

    const ambiguous = applyIconRevision({
      html: AGENDA,
      instruction: "Cambia solo l'icona",
    });
    assert.equal(ambiguous.status, "ambiguous");
    assert.equal(ambiguous.spent, false);
    assert.equal(ambiguous.html, AGENDA);
    assert.match(ambiguous.reason, /ambigua/i);
  });

  it("rejects worker full-rewrite/oversize, restores snapshot, refunds once", () => {
    const files = [
      { path: "index.html", content: AGENDA },
      { path: "src/screens/Home.tsx", content: "keep" },
    ];
    const rewrite = `${AGENDA}<div id="junk">${"x".repeat(ICON_DELTA_BUDGET + 80)}</div>`;
    const oversize = applyIconRevision({
      html: AGENDA,
      files,
      instruction: AGENDA_ICON_INSTRUCTION,
      worker: { html: rewrite, files: [...files, { path: "src/screens/New.tsx", content: "nope" }] },
    });
    assert.equal(oversize.status, "rejected");
    assert.equal(oversize.refund, true);
    assert.equal(oversize.html, AGENDA);
    assert.match(oversize.reason, /full-rewrite|oversize|deriva|non target/i);

    const project = {
      html: AGENDA,
      files,
      lastStableHtml: AGENDA,
      lastStableFiles: files,
      creditRefunded: false,
    };
    const first = refundIconFailure(project, oversize);
    assert.equal(first.refundedNow, true);
    assert.equal(first.creditRefunded, true);
    assert.equal(first.html, AGENDA);
    const second = refundIconFailure({ ...project, creditRefunded: true }, oversize);
    assert.equal(second.refundedNow, false);
    assert.equal(second.html, AGENDA);

    const huge = applyIconRevision({
      html: AGENDA,
      files,
      instruction: AGENDA_ICON_INSTRUCTION,
      worker: { html: `${"<!DOCTYPE html><html><body>nope</body></html>"}${"n".repeat(ICON_HTML_BOUND + 10)}` },
    });
    assert.equal(huge.status, "rejected");
    assert.equal(huge.refund, true);
  });

  it("keeps Agenda publishable and blocks overflow/undefined/NaN", () => {
    const contract = planContract(BRIEF);
    const patched = applyIconPatch(AGENDA, "icon:home", AGENDA_CALENDAR_SVG);
    assert.equal(patched.applied, true);
    const evaluation = evaluateContract({
      html: patched.html,
      files: [{ path: "index.html", content: patched.html }],
      contract,
      kind: "app",
      brief: BRIEF,
    });
    assert.equal(
      evaluation.ok,
      true,
      evaluation.checks.filter((c) => !c.ok).map((c) => `${c.id}:${c.detail}`).join(" · "),
    );
    assert.equal(blocksPublish(patched.html, "app", undefined, BRIEF), "");
    assert.equal(
      isPublishable({ status: "ready", html: patched.html, kind: "app", prompt: BRIEF }),
      true,
    );

    assert.equal(leakedRuntimeText(BROKEN), true);
    const bad = evaluateContract({
      html: BROKEN,
      files: [{ path: "index.html", content: BROKEN }],
      contract,
      kind: "app",
      brief: BRIEF,
    });
    assert.equal(bad.ok, false);
    const ids = bad.checks.filter((c) => !c.ok).map((c) => c.id);
    assert.ok(ids.includes("leaked-text") || ids.includes("overflow") || ids.includes("graphic"), ids.join(","));
    assert.match(blocksPublish(BROKEN, "app", undefined, BRIEF), /undefined|overflow|graphic|NaN|clip/i);
    assert.equal(isPublishable({ status: "ready", html: BROKEN, kind: "app", prompt: BRIEF }), false);
  });
});
