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
    claim:
      "BuildContract v1 tipizzato: kind, intent, screens/route, entità, journeys, acceptance, visual DNA, a11y/sicurezza/responsive, file tree.",
    evidence: "src/lib/ai/build-contract.test.ts · parseContract(planContract) su 3 famiglie",
    ok: true,
  },
  {
    id: "roles",
    claim:
      "Ruoli planner/visual/builder/critic/repairer sullo stesso grok-build-0.1. Ricevute sintetiche, niente CoT, niente reasoningEffort.",
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
    claim:
      "Prompt e contratto condivisi tra API build e Netlify Edge. Repair max 2. Worker resta grok-build-0.1 senza chiamate extra.",
    evidence:
      "prompts.shared.ts PLAN/REPAIR; api/build.ts + edge build.ts planContract; BOOT_REPAIR_MAX=2",
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
    claim:
      "Dashboard multi-file: index.html collega css/theme.css e js/app.js; il runtime legge data/ordini.json, niente secret.",
    evidence: "src/lib/ai/build-contract.test.ts fixture dashboard-multifile (DASHBOARD_MOCK)",
    ok: true,
  },
  {
    id: "eval-negative",
    claim:
      "Gate negativi: secret, eval, kind-lock tabbar su dashboard, iOS cheap. Contratto blocking ferma t:ok/ready/Pubblica.",
    evidence:
      "src/lib/ai/build-contract.test.ts rejects + false-positive gates closed (eval/secret/CRUD)",
    ok: true,
  },
  {
    id: "files-tree",
    claim:
      "File obbligatori del contratto devono esistere. CSS, JS e dati mock sono richiesti solo se il brief domanda dati mock/API locale/multi-file. La sola parola «ordini» non inventa file. Un runtime incompleto fallisce; l'albero completo passa.",
    evidence: "src/lib/ai/build-contract.test.ts requested runtime files missing/complete",
    ok: true,
  },
  {
    id: "multifile-runtime",
    claim:
      "CSS/JS locali referenziati da index.html e fetch di dati del tree diventano un artifact singolo riproducibile. Script non referenziati, traversal e URL esterni non vengono incorporati.",
    evidence:
      "src/lib/projects/files.test.ts bundle multi-file + src/components/publish-panel.tsx publishedHtml",
    ok: true,
  },
  {
    id: "aa-fail-closed",
    claim:
      "AA fail-closed: palette assente o contrasto < 4.5 (anche body #777/#777) blocca. Niente 'palette assente ⇒ ok'.",
    evidence: "src/lib/ai/build-contract.test.ts AA fail-closed; extractColorPair",
    ok: true,
  },
  {
    id: "budget",
    claim:
      "Critic LLM saltato se i gate statici passano; desk e iterate non pagano un secondo giro. Planner 0 token.",
    evidence: "src/lib/ai/build-contract.test.ts criticBudget static-ok/desk/iterate",
    ok: true,
  },
  {
    id: "browser-dtm",
    claim:
      "D/T/M: console 0, overflow ≤8, focus visibile (outline/box-shadow) e target ≥24px misurati in Chromium sul srcdoc (runtime Fenix + kit preview). Screenshot + manifest sha256 in src/lib/ai/fixtures/dtm (presenza e peso, non pixel-hash in CI). Claim ridotto da 44px: 24px è la soglia asserita.",
    evidence:
      "src/lib/ai/build-contract-browser.test.ts viewports 1280/768/390 + fixtures/dtm/manifest.json",
    ok: true,
  },
  {
    id: "generated-ui-regressions",
    claim:
      "Output generato: CSS visibile bloccato e riparato per selettori generici; gestionali con schema coerente e controlli rifiniti; app con tabbar fissa, altezza invariabile, safe area e palette calda fangosa normalizzata.",
    evidence:
      "validate-html.test.ts generic CSS leak · dashboard-crud.test.ts client schema/style · preview-contrast.test.ts 5 tab × 390/430",
    ok: true,
  },
  {
    id: "revision-branches",
    claim:
      "Qualsiasi cottura crea un progetto ramo indipendente con HTML e file esatti. Un merge three-way riporta le sole modifiche non conflittuali; uno stesso file divergente ferma l'intera unione. Dati, chat, job e identità di deploy restano nel progetto sorgente.",
    evidence:
      "revisions.test.ts isolamento/merge/conflitti + revisions-browser.test.ts D/T/M ramo, unione e rollback",
    ok: true,
  },
  {
    id: "data-api-local-first",
    claim:
      "Le app generate hanno un'API JSON local-first query/list/get/insert/update/remove. Le mutazioni concorrenti nella stessa app sono serializzate per collezione; token riservati o traversal non raggiungono il bridge. Senza un invito esplicito il runtime resta privato.",
    evidence:
      "src/lib/projects/fenix-data-api.ts + fenix-browser.test.ts CRUD Promise.all, filtri, isolamento collezioni, remount e console 0",
    ok: true,
  },
  {
    id: "published-cloud-private-data",
    claim:
      "Le app pubblicate passano al cloud-private quando DATABASE_URL è disponibile: cookie anonimo HttpOnly per sito, solo hash nel DB, JSON ≤256 KB, corpo HTTP interrotto prima del parsing oltre il limite, revisioni CAS e un solo vincitore concorrente. Il carico riproducibile prova 24 soggetti × 4 collezioni e un burst di 32 writer. Errori di validazione, autorizzazione e conflitto restano fail-closed; solo 503/rete ripiega sul locale. Senza capability di collaborazione il dataset resta isolato per soggetto.",
    evidence:
      "migrations/0004_generated_app_data.sql + cloud-data.test.ts SQL/HTTP + cloud-data-load.test.ts 96 collezioni/32 writer + sito-db.test.ts trasporto, retry, conflitto e fallback",
    ok: true,
  },
  {
    id: "continuous-production-smoke",
    claim:
      "Ogni CI main riuscita innesca un controllo bounded: attende il deploy Git Netlify sullo SHA esatto, verifica root e asset hashed, contratto Edge /api/build, Railway grok-build-0.1 e SLO 8s senza secret.",
    evidence:
      ".github/workflows/production-smoke.yml + scripts/production-smoke.mjs + production-smoke.test.mjs",
    ok: true,
  },
  {
    id: "project-activity-ledger",
    claim:
      "Ogni progetto conserva un registro operativo redatto e limitato: build, esiti, rimborsi, dati, versioni, rami, pubblicazioni ed export. I rami non ereditano la cronologia sorgente; prompt, messaggi, job id e segreti non entrano nel registro.",
    evidence:
      "activity.ts + revisions.test.ts redazione/dedupe/cap/isolamento + revisions-browser.test.ts registro accessibile D/T/M",
    ok: true,
  },
  {
    id: "portable-zip-import",
    claim:
      "Un export ZIP Fenix riapre l'intero albero in un nuovo studio indipendente senza consumare crediti. Import fail-closed: formato stored UTF-8, limite 2 MB, CRC, manifest e file devono coincidere; traversal, secret, extra, corruzione e gate anteprima falliti non creano progetti.",
    evidence:
      "zip.ts importProjectArchive + files.test.ts casi negativi + files-browser.test.ts import D/T/M, console 0 e isolamento",
    ok: true,
  },
  {
    id: "github-verified-roundtrip",
    claim:
      "Un albero esportato da Fenix può tornare da un repo/branch GitHub solo dopo un click esplicito. L'installation token resta server-only; tree troncati, repo estranei, blob non UTF-8/100644, limiti, secret e mismatch manifest/checksum fermano l'import. Il risultato è un progetto nuovo senza stato operativo ereditato.",
    evidence:
      "github/import.ts + github.test.ts round-trip/tamper/truncated/owner + github-browser.test.ts D/T/M, zero auto-POST, console e overflow puliti",
    ok: true,
  },
  {
    id: "published-data-collaboration",
    claim:
      "Il titolare può condividere i dati di un'app pubblicata con link viewer/editor revocabili. La capability a 256 bit appare una volta, viene salvata solo come hash e passa a un cookie HttpOnly scoped; il frammento sparisce prima del fetch del sito. Browser distinti vedono lo stesso dataset CAS, un viewer non scrive e una revoca ferma il token senza fallback privato ambiguo.",
    evidence:
      "app-collaboration.test.ts + cloud-data.test.ts shared roles/revoke/CAS + app-collaboration-browser.test.ts D/T/M, fragment scrub, HttpOnly e cloud-shared cross-browser",
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
