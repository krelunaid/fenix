/**
 * Fase 3 scorecard. Points are awarded only to reproducible repository
 * evidence. This is a conservative capability score, never a parity claim.
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
    ],
    remaining:
      "Manca un backend generato e distribuibile insieme al tree; i dati cloud sono un servizio gestito Fenix, non file server del progetto.",
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
    ],
    remaining:
      "Fenix.data resta shared=false: niente identità cross-device, database condiviso tra utenti, auth degli utenti finali, API server generate o connettori applicativi.",
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
    ],
    remaining:
      "Mancano workspace condivisi, ruoli, presenza multi-utente e prove di carico distribuito.",
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
    ],
    remaining:
      "Servono più benchmark reali indipendenti e una valutazione comparativa cieca su categorie diverse.",
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
    ],
    remaining:
      "TestFlight e Play internal richiedono account/ruoli/secret esterni; manca il carico sul database di produzione, che non è configurato.",
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
