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
    evidence: "src/lib/ai/build-contract.test.ts · parseContract(planContract) su 6 prodotti",
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
      "AA fail-closed: palette assente o contrasto < 4.5 (anche body #777/#777, last-wins sull'ultimo body) blocca. Niente 'palette assente ⇒ ok'.",
    evidence: "src/lib/ai/build-contract.test.ts AA fail-closed; extractColorPair last body",
    ok: true,
  },
  {
    id: "budget",
    claim:
      "Critic LLM saltato se i gate (incluso grafico) passano; desk, iterate e graphic fail-closed non pagano un secondo giro. Planner 0 token. La QA visiva a screenshot non è un voto autoassegnato.",
    evidence: "src/lib/ai/build-contract.test.ts criticBudget static-ok/desk/iterate/graphic",
    ok: true,
  },
  {
    id: "browser-dtm",
    claim:
      "Sei prodotti distinti eseguono 18 percorsi funzionali D/T/M: console 0, overflow ≤8, focus visibile (outline/box-shadow) e target ≥24px misurati in Chromium sul srcdoc. Screenshot + manifest sha256 in src/lib/ai/fixtures/dtm (presenza e peso, non pixel-hash in CI).",
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
      "Ogni progetto conserva un registro operativo redatto e limitato: build, esiti, rimborsi, dati, versioni, rami, pubblicazioni ed export. Un riepilogo D/T/M aggrega esiti e crediti; il report diagnostico JSON esportabile omette identità, prompt, messaggi, HTML, file, dati e job id. I rami non ereditano la cronologia sorgente.",
    evidence:
      "activity.ts + revisions.test.ts redazione/dedupe/cap/report/isolamento + revisions-browser.test.ts riepilogo ed export D/T/M",
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
    id: "portable-generated-backend",
    claim:
      "Un brief che chiede esplicitamente full-stack/backend/API server aggiunge un manifest schema al contratto. Fenix sostituisce ogni server arbitrario con un runtime Node+SQLite deterministico nel tree: signup/login email-password scrypt, sessioni opache archiviate solo come hash in cookie HttpOnly, recupero password enumeration-safe e accesso passwordless magic-link/OTP con outbox SQLite, isolamento record per utente, Bearer server-to-server, Origin allowlist, corpo 256 KB, campi validati, CRUD e If-Match CAS. ZIP round-trip, due account isolati e 16 scritture concorrenti sono provati avviando il server reale.",
    evidence:
      "portable-backend.ts + portable-backend.test.ts runtime/ZIP/signup/login/logout/sessioni/isolamento/auth/validation/CAS/burst + build-contract.ts gate blocking",
    ok: true,
  },
  {
    id: "portable-fullstack-deploy",
    claim:
      "Il progetto full-stack esportato avvia frontend e API sulla stessa origine, con health, node --check e fenix.deploy.json. Tre fixture distinte (Argilla, forno, bottega) fanno signup/CRUD dopo l'upgrade v1→v4; una migrazione rotta resta atomica. D/T/M sulla UI accoppiata, cookie HttpOnly, niente secret nei log.",
    evidence:
      "portable-backend.test.ts 3 fixture/same-origin/upgrade/fail-closed/porte isolate + portable-backend-browser.test.ts D/T/M console overflow focus",
    ok: true,
  },
  {
    id: "portable-account-recovery",
    claim:
      "Il backend portabile offre recupero account senza SMTP né credenziali esterne: POST /auth/recover è enumeration-safe, il token one-shot vive solo come hash con TTL 15 minuti, il reset scrypt revoca le sessioni e l'outbox SQLite è server-side. Due utenti, replay/expired/wrong, un solo vincitore concorrente e UI D/T/M senza token in localStorage.",
    evidence:
      "portable-backend.ts 0003_password_reset + /auth/recover|/auth/reset + portable-backend.test.ts isolamento/outbox/concorrenza + portable-backend-browser.test.ts D/T/M recovery",
    ok: true,
  },
  {
    id: "portable-passwordless",
    claim:
      "Il backend portabile offre accesso passwordless senza SMTP: POST /auth/passwordless è enumeration-safe per magic-link e OTP, i segreti vivono solo come hash (OTP scrypt, magic sha256) con TTL 10 minuti, one-shot, revoca dei precedenti e sessione opaca HttpOnly. Due utenti isolati, replay/expired/wrong, un solo vincitore concorrente e UI D/T/M senza token in localStorage.",
    evidence:
      "portable-backend.ts 0004_passwordless + /auth/passwordless|/auth/passwordless/verify + portable-backend.test.ts isolamento/outbox/concorrenza + portable-backend-browser.test.ts D/T/M passwordless",
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
    id: "vesti-collection-gate",
    claim:
      "Fenix.data accetta solo token [A-Za-z0-9._-]{1,80} e non slugifica. L'output Vesti di produzione usa var COL = \"capi vesti\" (non un literal in query): parser/adattatore/preview lo riscrivono nel set canonico capi; un token con slash resta fail-closed e non può ready/Pubblica. Patch su template assenti o SCREEN id irraggiungibile sono no-op deduplicate, extra al massimo una volta per tab, senza nuovi giri xAI. Repair max 2. Crediti 0 su questi gate.",
    evidence:
      "fenix-collection.test.ts (COL hole + rewrite capi + slash) + screen-patch.test.ts (unchanged≠absent, extraTried) + vesti-browser.test.ts D/T/M + fixtures/vesti-production.html + fixtures/vesti-eval.json + fixtures/shots/vesti/manifest.json",
    ok: true,
  },
  {
    id: "workspace-simultaneous-doc",
    claim:
      "Gli appunti del workspace sono un documento server-authoritative: insert/delete con op id e base/versione, replay idempotente, convergenza tra due editor su parti indipendenti, overlap/stale fail-closed. Viewer e editor revocato 403. Audit bounded senza token, PII o payload. UI D/T/M con stato di sincronizzazione. Non è un CRDT.",
    evidence:
      "workspace-doc.ts + workspace.ts op=doc + 0007_workspace_shared_doc + workspace.test.ts convergenza/replay/burst/stale/revoke + workspace-browser.test.ts D/T/M, due editor, viewer 403",
    ok: true,
  },
  {
    id: "postgres-16-reliability-harness",
    claim:
      "Un job GitHub CI blocking avvia PostgreSQL 16 reale (service postgres:16, healthcheck, credenziale fixture non-secret), applica le migrazioni Fenix e prova carico concorrente, CAS a un vincitore, isolamento tenant/ruoli, replay, pool bounded e un recovery drill pg_dump/pg_restore major 16 con checksum, row count e processo applicativo senza duplicati. PGlite non attribuisce punti. Report JSON redatto.",
    evidence:
      ".github/workflows/ci.yml job postgres-reliability + postgres-reliability.ts store Fenix + scripts/postgres-reliability.mjs + artifacts/postgres-reliability.json",
    ok: true,
  },
  {
    id: "graphic-quality-gate",
    claim:
      "Ready/pubblica richiede un gate grafico riproducibile: token e varianti dal brief, niente dead zone, empty state coerente, originalità anti-clone, imagery di dominio originale (data-imagery, alt, provenienza CC0), niente card-clone né canvas boxed. Essenza e i tre prodotti geometrici (Maison/Sfilata/Sala) falliscono; dieci prodotti premium (5 brief × 2 varianti) passano D/T/M. Protocollo cieco con rubric a 10 criteri; benchmark esterno non disponibile, confronto competitivo non concluso. Compilare non basta. Imagine solo su build utente, fallback SVG a 0 crediti.",
    evidence:
      "design-tokens.ts + domain-imagery.ts + graphic-quality.ts + graphic-quality.test.ts + graphic-quality-browser.test.ts + blind-visual-benchmark.ts fixtures/graphic shots",
    ok: true,
  },
  {
    id: "connectors-server-only",
    claim:
      "Sette famiglie di connettori passano da un gate server-only con grant, payload bounded e routing MCP esplicito.",
    evidence:
      "src/lib/app-data/catalog.ts + app-data.test.ts + connector-foundation.md",
    ok: true,
  },
  {
    id: "graphic-pipeline",
    claim:
      "La pipeline prompt→plan→generate→visual→QA produce sistemi visivi distinti per sei brief difficili (Essenza, Vesti, ospitalità, ristorazione, dashboard, portfolio) con tre coppie di direzioni diverse, grammatica D/T/M, palette dal brief, imagery di dominio originale e stati empty/loading/success/error. Seed deterministico 0 crediti; il path LLM parte da quel seed. Benchmark esterno non disponibile.",
    evidence:
      "compose-product.test.ts + compose-product-browser.test.ts + layout-grammar.test.ts + fixtures/graphic/pipeline",
    ok: true,
  },
  {
    id: "adaptive-palette",
    claim:
      "Motore palette deterministico: 8 famiglie distinte, override colore, anti-ripetizione OKLab sulle ultime 5, fallback hashato dal brief (mai #101114/#e1693f). Repository usa source-timeline, non home KPI.",
    evidence:
      "src/lib/projects/palette-engine.test.ts corpus 20+; src/lib/ai/compose-product.test.ts RepoVoci; fixtures/graphic/palette",
    ok: true,
  },
  {
    id: "agenda-icon-atomic-patch",
    claim:
      "Una richiesta puntuale di icona applica una patch atomica sul DOM con data-fenix-id, senza rigenerare l'app. File non target restano byte-identici; 5 viste, CRUD e Fenix.data restano intatti. Target assente/ambiguo non spende crediti; full-rewrite/oversize/drift del worker ripristina lastStable e rimborsa una volta, senza seconda POST. Il path icona fa un solo canary di boot, mai repair/consumeStream. Overflow, clipping/sovrapposizioni e testo undefined/null/NaN tengono chiusa Pubblica. Overlay totale durante il lavoro. 0 crediti xAI su questi gate.",
    evidence:
      "icon-patch.mjs listTabNodes + namedTabToken + icon-build.ts + icon-patch.test.ts domain ids/compose-product Agenda + icon-build.test.ts + agenda-browser.test.ts D/T/M + fixtures/agenda.html + compose-product/craft-icons/app-shell data-fenix-id + run-build polishDraft short-circuit",
    ok: true,
  },
  {
    id: "generated-app-craft",
    claim:
      "Il generatore condiviso (composeProduct, non le sole fixture) produce cinque brief distinti — Agenda, profumi, abbigliamento, note/repository, ristorazione — con icone semantiche su griglia 24, palette diverse dal brief (override utente conservato), tipo 17/headline, imagery di dominio e niente hero KPI o tab Home/Elenco sull'agenda. Before/after D/T/M su parent 77e2cb4, chrome di famiglia visibile su mobile, ΔE palette ≥ 14. D/T/M, CRUD reale, console pulita, AA, overflow/clipping chiusi. Punteggio tecnico, giudizio grafico e benchmark esterno restano assi distinti. Nessun 9/10 senza prova. 0 crediti xAI su questi gate.",
    evidence:
      "compose-product.ts GRAPHIC_FIVE_PARENT_SHA + familyChromeCss + craft-icons.ts data-icon-grid=24 + design-tokens booking 17/1.75 + compose-product.test.ts five briefs + compose-product-browser.test.ts D/T/M CRUD + fixtures/graphic/five before/after",
    ok: true,
  },
  {
    id: "agenda-runtime",
    claim:
      "Agenda generata: settimana Lun-Dom allineata al giorno selezionato (prev/next/oggi senza spostare gli ISO salvati); selezione ISO/ARIA/tastiera; stato distinto dall'orario; form di dominio; create/update/delete/advance con esito bridge (niente falso successo, rollback e form integro se reject/timeout); empty-state unico (dati ⇒ zero empty, zero dati ⇒ uno solo, niente kit «Nessun elemento»). 0 crediti xAI. Residui fonte, non dichiarati runtime-proven: saveOnce avvolge Fenix.save in Promise.resolve e non cattura un throw sincrono prima della Promise; bridge assente risolve ok; reject/timeout solo su M e saves>=2 non prova il limite esatto. settleVisual #toast 4s vs ping 1600ms: un fail isolato con suite da ~15 min non è riprodotto (hide a ~1.8s). Il five-brief grafico ha before/after su parent 77e2cb4; non è prova di 9/10.",
    evidence:
      "compose-product.ts mondayOf/week-nav/persistThen + color-scheme.ts productOwnsList + compose-product.test.ts + agenda-runtime-browser.test.ts D/T/M empty-state + bridge reject/timeout + fixtures/shots/agenda-runtime",
    ok: true,
  },
  {
    id: "emergent",
    claim:
      "Emergent resta un benchmark esterno: fonti ufficiali e dieci assi sono datati, ma nessuna graduatoria competitiva è provata senza la stessa esecuzione testa-a-testa.",
    evidence:
      "src/lib/projects/emergent-competitive-benchmark.ts + emergent-competitive-benchmark.test.ts + emergent-competitive-benchmark.md",
    ok: true,
  },
];

export function qualityLedgerOk(): boolean {
  return QUALITY_LEDGER.every((row) => row.ok);
}
