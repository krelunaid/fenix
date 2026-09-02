/**
 * Fase 3 scorecard. Points are awarded only to reproducible repository
 * evidence. This is a conservative capability score, never a parity claim.
 * 100/100 is the internal evidence ceiling of this repository; it is not a
 * competitive ranking against Emergent or any other product.
 */
export type ScoreEvidence = {
  id: string;
  points: number;
  claim: string;
  reproduce: string;
};

export type ScoreDimension = {
  id:
    | "architecture"
    | "versions-git"
    | "backend-auth-data"
    | "collaboration-operations"
    | "generated-quality"
    | "reliability-deploy";
  label: string;
  max: number;
  evidence: ScoreEvidence[];
  remaining: string;
};

export const FASE3_SCORECARD: ScoreDimension[] = [
  {
    id: "architecture",
    label: "Architettura multi-file / full-stack",
    max: 20,
    evidence: [
      {
        id: "tree-ingest-runtime",
        points: 6,
        claim:
          "Albero POSIX validato e runtime multi-file assemblato senza eseguire file non referenziati.",
        reproduce: "npm test -- src/lib/projects/files.test.ts",
      },
      {
        id: "tree-contract",
        points: 2,
        claim:
          "Il contratto richiede i file solo quando il brief li domanda e blocca runtime incompleti.",
        reproduce: "npm test -- src/lib/ai/build-contract.test.ts",
      },
      {
        id: "portable-tree",
        points: 3,
        claim:
          "ZIP Fenix esportato e reimportato con CRC, manifest, checksum e isolamento verificati.",
        reproduce:
          "npm test -- src/lib/projects/files.test.ts src/lib/projects/files-browser.test.ts",
      },
      {
        id: "tree-studio-dtm",
        points: 1,
        claim:
          "Albero e import sono usabili in studio desktop, tablet e telefono con console pulita.",
        reproduce: "npm test -- src/lib/projects/files-browser.test.ts",
      },
      {
        id: "portable-node-backend",
        points: 5,
        claim:
          "Un brief full-stack esplicito aggiunge al tree un backend Node+SQLite deterministico, esportabile e avviabile con schema, package e runtime reali; manifest invalidi bloccano ready/pubblica.",
        reproduce:
          "npm test -- src/lib/projects/portable-backend.test.ts src/lib/ai/build-contract.test.ts",
      },
      {
        id: "portable-fullstack-deploy",
        points: 3,
        claim:
          "Il progetto esportato avvia frontend e API sulla stessa origine con health, build `node --check` e manifest di deploy; migrazioni SQL versionate, idempotenti e forward-only aggiornano una fixture v1 a v3 senza perdita dati e restano fail-closed.",
        reproduce:
          "npm test -- src/lib/projects/portable-backend.test.ts src/lib/projects/portable-backend-browser.test.ts",
      },
    ],
    remaining:
      "Il deploy accoppiato è un processo Node+SQLite sulla stessa origine, con migrazioni forward-only: resta fuori un database distribuito generato.",
  },
  {
    id: "versions-git",
    label: "Iterazione / versioni / Git",
    max: 15,
    evidence: [
      {
        id: "revision-rollback",
        points: 4,
        claim: "Cotture versionate e rollback CAS senza perdere il ramo corrente.",
        reproduce:
          "npm test -- src/lib/projects/revisions.test.ts src/lib/projects/revisions-browser.test.ts",
      },
      {
        id: "independent-branch",
        points: 3,
        claim:
          "Ramo da qualsiasi revisione con codice/file copiati e dati, chat, job e deploy isolati.",
        reproduce: "npm test -- src/lib/projects/revisions.test.ts",
      },
      {
        id: "branch-three-way-merge",
        points: 2,
        claim:
          "Unione three-way ramo→origine per file: modifiche indipendenti convergono e i conflitti fermano tutto senza copiare stato operativo.",
        reproduce:
          "npm test -- src/lib/projects/revisions.test.ts src/lib/projects/revisions-browser.test.ts",
      },
      {
        id: "github-export",
        points: 4,
        claim:
          "Export GitHub App server-only blob→tree→commit→ref, force=false, idempotente e redatto.",
        reproduce:
          "npm test -- src/lib/github/github.test.ts src/lib/github/github-browser.test.ts",
      },
      {
        id: "portable-export",
        points: 1,
        claim: "Portabilità locale ZIP senza crediti e senza ereditare identità operative.",
        reproduce: "npm test -- src/lib/projects/files.test.ts",
      },
      {
        id: "github-verified-pull",
        points: 1,
        claim:
          "Pull GitHub server-only di un albero Fenix verificato, senza token client, con nuovo studio isolato D/T/M.",
        reproduce:
          "npm test -- src/lib/github/github.test.ts src/lib/github/github-browser.test.ts",
      },
    ],
    remaining:
      "La dimensione è al massimo verificabile definito: resta fuori scope il sync VS Code generico e la risoluzione assistita dei conflitti remoti.",
  },
  {
    id: "backend-auth-data",
    label: "Backend / auth / dati / integrazioni",
    max: 15,
    evidence: [
      {
        id: "local-data-api",
        points: 3,
        claim:
          "API JSON query/list/get/insert/update/remove con mutazioni serializzate e token fail-closed.",
        reproduce: "npm test -- src/lib/projects/fenix-browser.test.ts",
      },
      {
        id: "publish-owner",
        points: 1,
        claim:
          "La pubblicazione è owner-bound e usa precondizioni di versione; ownerHash non è pubblico.",
        reproduce:
          "npm test -- src/lib/projects/published.test.ts src/lib/projects/published-browser.test.ts",
      },
      {
        id: "cloud-private-data",
        points: 2,
        claim:
          "Archivio Postgres JSON per sito/sessione anonima HttpOnly, isolato per collezione e protetto da revisioni CAS.",
        reproduce: "npm test -- src/lib/projects/cloud-data.test.ts",
      },
      {
        id: "published-cloud-bridge",
        points: 1,
        claim:
          "Le app pubblicate usano il cloud privato quando configurato, deduplicano i retry e ripiegano sul locale solo per indisponibilità esplicita.",
        reproduce: "npm test -- src/lib/projects/sito-db.test.ts",
      },
      {
        id: "shared-data-capability-roles",
        points: 3,
        claim:
          "Dati cloud condivisi cross-device con link-capability viewer/editor, token hash-only, revoca immediata e CAS fail-closed.",
        reproduce:
          "npm test -- src/lib/projects/app-collaboration.test.ts src/lib/projects/cloud-data.test.ts src/lib/projects/app-collaboration-browser.test.ts",
      },
      {
        id: "portable-api-auth-cas",
        points: 4,
        claim:
          "Backend portabile con account email/password scrypt, sessioni opache hash-only in cookie HttpOnly, isolamento record per utente e Bearer server-to-server; origine allowlist, corpo bounded, CRUD validato, If-Match CAS e burst concorrente sono provati sul runtime reale.",
        reproduce: "npm test -- src/lib/projects/portable-backend.test.ts",
      },
      {
        id: "portable-account-recovery",
        points: 1,
        claim:
          "Recupero account enumeration-safe sul backend portabile: token one-shot ad alta entropia solo come hash, TTL 15 minuti, revoca delle sessioni, nuova password scrypt, outbox server-side senza SMTP e senza token/PII nei log; due utenti isolati, replay/expired/wrong e concorrenza con un solo vincitore.",
        reproduce:
          "npm test -- src/lib/projects/portable-backend.test.ts src/lib/projects/portable-backend-browser.test.ts",
      },
    ],
    remaining:
      "Restano fuori OAuth/magic-link, ruoli granulari per record e connettori applicativi; il recupero password è coperto senza credenziali esterne.",
  },
  {
    id: "collaboration-operations",
    label: "Collaborazione / operazioni / scalabilità",
    max: 15,
    evidence: [
      {
        id: "activity-ledger",
        points: 2,
        claim:
          "Registro progetto bounded e redatto per build, dati, versioni, rami/unioni, publish, export e rimborsi.",
        reproduce:
          "npm test -- src/lib/projects/revisions.test.ts src/lib/projects/revisions-browser.test.ts",
      },
      {
        id: "release-fsm",
        points: 2,
        claim: "Release FSM riprendibile e idempotente con fixture web/iOS/Android.",
        reproduce: "npm test -- src/lib/release/release.test.ts src/lib/release/fase2.test.ts",
      },
      {
        id: "job-lease",
        points: 1,
        claim:
          "Claim/lease del job visuale e recovery bounded sono coperti da concorrenza deterministica.",
        reproduce: "npm test -- src/lib/projects/visual-job.test.ts",
      },
      {
        id: "published-data-roles",
        points: 3,
        claim:
          "Il titolare crea e revoca inviti sola lettura/modifica; browser distinti condividono lo stesso archivio senza copiare il token nel progetto.",
        reproduce:
          "npm test -- src/lib/projects/app-collaboration.test.ts src/lib/projects/app-collaboration-browser.test.ts",
      },
      {
        id: "operational-diagnostics",
        points: 2,
        claim:
          "Riepilogo operativo D/T/M ed export diagnostico JSON redatto aggregano esiti e crediti senza identità, prompt, messaggi, codice, dati o job id.",
        reproduce:
          "npm test -- src/lib/projects/revisions.test.ts src/lib/projects/revisions-browser.test.ts",
      },
      {
        id: "workspace-roles-cas",
        points: 3,
        claim:
          "Workspace progetto con titolare, viewer ed editor isolati: invito one-shot hash-only, revoca immediata, albero in lettura al viewer, scritture If-Match CAS fail-closed e nessun ruolo dal browser.",
        reproduce:
          "npm test -- src/lib/projects/workspace.test.ts src/lib/projects/workspace-browser.test.ts",
      },
      {
        id: "workspace-presence-audit",
        points: 1,
        claim:
          "Presenza multi-sessione con TTL 45s e registro workspace bounded/redatto, senza token o hash identità esposti.",
        reproduce:
          "npm test -- src/lib/projects/workspace.test.ts src/lib/projects/workspace-browser.test.ts",
      },
      {
        id: "workspace-simultaneous-doc",
        points: 1,
        claim:
          "Documento testuale condiviso server-authoritative: insert/delete con op id, base/versione, idempotenza, ordine stabile e convergenza tra due editor su parti indipendenti; stale o non trasformabili falliscono chiusi senza perdita parziale. Viewer e editor revocato 403. Nessun CRDT dichiarato.",
        reproduce:
          "npm test -- src/lib/projects/workspace.test.ts src/lib/projects/workspace-browser.test.ts",
      },
    ],
    remaining:
      "I 15 punti coprono ruoli, presenza, registro e un documento testuale con convergenza deterministica sul server. Restano fuori un CRDT su ogni file, i workspace organizzativi SSO e un APM centralizzato.",
  },
  {
    id: "generated-quality",
    label: "Qualità generata e UX",
    max: 15,
    evidence: [
      {
        id: "contract-evaluator",
        points: 3,
        claim: "Contratto v1, evaluator statico e gate blocking condiviso tra API ed Edge.",
        reproduce: "npm test -- src/lib/ai/build-contract.test.ts",
      },
      {
        id: "three-products-dtm",
        points: 4,
        claim:
          "Gestionale, app mobile e dashboard multi-file provati con fixture e viewport D/T/M.",
        reproduce:
          "npm test -- src/lib/ai/build-contract.test.ts src/lib/ai/build-contract-browser.test.ts",
      },
      {
        id: "visual-regressions",
        points: 3,
        claim:
          "CSS grezzo, schema gestionale, tabbar mobile e palette fangose hanno regressivi dedicati.",
        reproduce:
          "npm test -- src/lib/projects/validate-html.test.ts src/lib/projects/dashboard-crud.test.ts src/lib/projects/preview-contrast.test.ts",
      },
      {
        id: "accessibility",
        points: 2,
        claim: "Contrasto AA fail-closed, focus, overflow e target misurati in browser.",
        reproduce:
          "npm test -- src/lib/ai/build-contract-browser.test.ts src/lib/projects/visual-quality.test.ts",
      },
      {
        id: "six-product-functional-benchmark",
        points: 3,
        claim:
          "Sei prodotti distinti eseguono 18 percorsi funzionali D/T/M con screenshot sha256, console pulita, overflow, focus e target verificati.",
        reproduce:
          "npm test -- src/lib/ai/build-contract.test.ts src/lib/ai/build-contract-browser.test.ts",
      },
    ],
    remaining:
      "La dimensione qualità resta al massimo; i gate Vesti sono nel ledger ma non aggiungono punti. Resta utile una valutazione comparativa cieca esterna, che non viene simulata nel repository.",
  },
  {
    id: "reliability-deploy",
    label: "Affidabilità / sicurezza / deploy",
    max: 20,
    evidence: [
      {
        id: "sandbox-secrets",
        points: 5,
        claim: "Sandbox opaca, no allow-same-origin, secret scan e file/tree fail-closed.",
        reproduce: "npm test -- src/lib/projects/fenix-qa.test.ts src/lib/projects/files.test.ts",
      },
      {
        id: "recovery-refund",
        points: 4,
        claim: "Gate srcdoc, repair max 2, recovery e rimborso impediscono ready/pubblica falsi.",
        reproduce:
          "npm test -- src/lib/projects/recover.test.ts src/lib/projects/site-repair.test.ts src/lib/projects/site-repair-browser.test.ts",
      },
      {
        id: "build-ci-web",
        points: 4,
        claim: "Typecheck, build, suite completa e pipeline web sono riproducibili nel repository.",
        reproduce: "npm run typecheck && npm run build && npm test",
      },
      {
        id: "mobile-pipelines",
        points: 3,
        claim:
          "Pipeline iOS/Android e build Gradle reale sono coperte senza fingere account store.",
        reproduce: "npm test -- src/lib/release/fase2.test.ts src/lib/release/gradle-real.test.ts",
      },
      {
        id: "cloud-data-load-guard",
        points: 1,
        claim:
          "Il servizio dati limita il corpo HTTP prima del parsing e prova 96 collezioni isolate più un burst CAS di 32 writer.",
        reproduce:
          "npm test -- src/lib/projects/cloud-data.test.ts src/lib/projects/cloud-data-load.test.ts",
      },
      {
        id: "continuous-production-smoke",
        points: 1,
        claim:
          "Dopo ogni CI main verde, un job bounded attende lo SHA Netlify esatto e verifica root, asset, Edge, Railway e SLO 8s.",
        reproduce:
          "FENIX_EXPECTED_SHA=$(git rev-parse HEAD) FENIX_SMOKE_ATTEMPTS=1 npm run smoke:production",
      },
      {
        id: "postgres-16-reliability-harness",
        points: 2,
        claim:
          "Harness PostgreSQL 16 reale in CI (non PGlite): migrazioni 0001–0007, carico concorrente multi-soggetto/collezione, CAS un solo vincitore, isolamento tenant/ruoli, replay idempotente, pool bounded, p95/p99 sotto soglie esplicite; recovery drill pg_dump/pg_restore major 16 su database pulito con checksum, row count e processo applicativo senza duplicati. Credenziali solo fixture CI, report JSON redatto.",
        reproduce: "npm run test:postgres-reliability",
      },
    ],
    remaining:
      "TestFlight e Play internal restano fuori: richiedono account, ruoli e secret di store esterni. Il carico e il recovery sono sul PostgreSQL 16 di CI, non sul database di produzione.",
  },
];

export function scoreDimension(dimension: ScoreDimension): number {
  return dimension.evidence.reduce((sum, row) => sum + (row.points > 0 ? row.points : 0), 0);
}

export function fase3Score(): { score: number; max: number; complete: boolean } {
  const score = FASE3_SCORECARD.reduce((sum, dimension) => sum + scoreDimension(dimension), 0);
  const max = FASE3_SCORECARD.reduce((sum, dimension) => sum + dimension.max, 0);
  return { score, max, complete: score === max };
}
