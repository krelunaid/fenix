/**
 * Fase 3 quality ledger. Evidence citations, not Emergent parity.
 * Each row names the test or artifact that proves the claim.
 */
export type LedgerRow = {
  id: string;
  claim: string;
  evidence: string;
  ok: boolean;
};

export const QUALITY_LEDGER: LedgerRow[] = [
  {
    id: "contract-schema",
    claim: "BuildContract v1 tipizzato: kind, intent, screens/route, entità, journeys, acceptance, visual DNA, a11y/sicurezza/responsive, file tree.",
    evidence: "src/lib/ai/build-contract.test.ts · parseContract(planContract) su 3 famiglie",
    ok: true,
  },
  {
    id: "roles",
    claim: "Ruoli planner/visual/builder/critic/repairer sullo stesso grok-build-0.1. Ricevute sintetiche, niente CoT, niente reasoningEffort.",
    evidence: "src/lib/ai/build-contract.ts ROLE_LABEL + fenix-qa.test.ts grok-build-0.1",
    ok: true,
  },
  {
    id: "planner-static",
    claim: "Planner deterministico: nessuna chiamata xAI, nessun credito.",
    evidence: "src/lib/ai/plan.ts senza fetch; build-contract.test.ts planContract",
    ok: true,
  },
  {
    id: "shared-protocol",
    claim: "Prompt e contratto condivisi tra API build e Netlify Edge. Repair max 2. Worker resta grok-build-0.1 senza chiamate extra.",
    evidence: "prompts.shared.ts PLAN/REPAIR; api/build.ts + edge build.ts planContract; BOOT_REPAIR_MAX=2",
    ok: true,
  },
  {
    id: "eval-crud",
    claim: "Gestionale CRUD: HTML valido, Fenix.load/save, viste, kind-lock dashboard, AA.",
    evidence: "src/lib/ai/build-contract.test.ts fixture gestionale-crud (DEMOS.kiln)",
    ok: true,
  },
  {
    id: "eval-mobile",
    claim: "Consumer/mobile: 3+ viste, Fenix, chrome telefono, AA, kind=app.",
    evidence: "src/lib/ai/build-contract.test.ts fixture consumer-mobile (DEMOS.grottaglie)",
    ok: true,
  },
  {
    id: "eval-multifile",
    claim: "Dashboard multi-file: index.html + data/ordini.json + api/mock.js ingestiti, niente secret.",
    evidence: "src/lib/ai/build-contract.test.ts fixture dashboard-multifile (DASHBOARD_MOCK)",
    ok: true,
  },
  {
    id: "eval-negative",
    claim: "Gate negativi: secret, eval, kind-lock tabbar su dashboard, iOS cheap. Contratto blocking ferma t:ok/ready/Pubblica.",
    evidence: "src/lib/ai/build-contract.test.ts rejects + false-positive gates closed (eval/secret/CRUD)",
    ok: true,
  },
  {
    id: "files-tree",
    claim: "File obbligatori del contratto devono esistere. Extra mock solo se il brief li chiede (dati mock / API locale / data/ordini.json). Un gestionale con la parola «ordini» non inventa un JSON. Dashboard mock senza il file fallisce; con file passa.",
    evidence: "src/lib/ai/build-contract.test.ts file-tree dashboard without/with data/ordini.json",
    ok: true,
  },
  {
    id: "aa-fail-closed",
    claim: "AA fail-closed: palette assente o contrasto < 4.5 (anche body #777/#777) blocca. Niente 'palette assente ⇒ ok'.",
    evidence: "src/lib/ai/build-contract.test.ts AA fail-closed; extractColorPair",
    ok: true,
  },
  {
    id: "budget",
    claim: "Critic LLM saltato se i gate statici passano; desk e iterate non pagano un secondo giro. Planner 0 token.",
    evidence: "src/lib/ai/build-contract.test.ts criticBudget static-ok/desk/iterate",
    ok: true,
  },
  {
    id: "browser-dtm",
    claim: "D/T/M: console 0, overflow ≤8, focus visibile (outline/box-shadow) e target ≥24px misurati in Chromium sul srcdoc (runtime Fenix + kit preview). Screenshot + manifest sha256 in src/lib/ai/fixtures/dtm (presenza e peso, non pixel-hash in CI). Claim ridotto da 44px: 24px è la soglia asserita.",
    evidence: "src/lib/ai/build-contract-browser.test.ts viewports 1280/768/390 + fixtures/dtm/manifest.json",
    ok: true,
  },
  {
    id: "emergent",
    claim: "Emergent resta solo un banco di prova. Nessun claim di completezza sul prodotto.",
    evidence: "src/lib/projects/fase3-gap.ts quality.slice=now; revisions.test.ts now list",
    ok: true,
  },
];

export function qualityLedgerOk(): boolean {
  return QUALITY_LEDGER.every((row) => row.ok);
}
