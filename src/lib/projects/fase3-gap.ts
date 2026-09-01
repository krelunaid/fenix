/**
 * Fase 3 gap matrix vs Emergent (2026 product, not brochure parity).
 * Evidence: help.emergent.sh GitHub (Standard+), tested full-stack + Stripe + auth,
 * user reports of Rollback/Fork. Fenix measured from src on main.
 */
export type GapImpact = "high" | "medium" | "low";
export type GapCost = "high" | "medium" | "low";
export type GapSlice = "now" | "next" | "later";

export type Fase3Gap = {
  id: string;
  area: string;
  emergent: string;
  fenix: string;
  impact: GapImpact;
  cost: GapCost;
  slice: GapSlice;
};

export const FASE3_GAPS: Fase3Gap[] = [
  {
    id: "revisions",
    area: "Iterazione / versioni / rollback",
    emergent: "Rollback e Fork: Ctrl+Z sulla cottura AI, duplica senza toccare il main.",
    fenix:
      "Cotture fotografate (html+files). Ripristino CAS e ramo indipendente da qualsiasi cottura, max 16. Unione three-way nel progetto origine: modifiche indipendenti convergono, stesso file divergente ferma tutto senza merge parziale. Il ramo copia e riunisce solo codice/file, mai dati, chat, job o deploy; niente secret nel log.",
    impact: "high",
    cost: "medium",
    slice: "now",
  },
  {
    id: "project-tree",
    area: "Progetti multi-file / full-stack",
    emergent: "Albero React/Next + backend Node/FastAPI + Mongo, file veri.",
    fenix:
      "Albero POSIX durevole: ingest (no .., no assoluti, no secret/binari, 48 file / 1.5MB). Entrypoint index.html, migrazione HTML-only senza perdere kind/storage/publish. ZIP+fenix.json esportabile e reimportabile in uno studio indipendente: solo entry UTF-8 non compresse, checksum e manifest/file verificati, gate anteprima prima di ready. Studio ispeziona l'albero D/T/M. CSS/JS locali esplicitamente referenziati e dati fetch vengono assemblati in un artifact validabile. Un brief full-stack esplicito include un manifest schema e Fenix materializza nel tree un backend Node+SQLite avviabile, con package, schema, API e README deterministici; codice server arbitrario del modello non prevale. Resta singolo nodo, senza deploy accoppiato o database distribuito generato.",
    impact: "high",
    cost: "high",
    slice: "now",
  },
  {
    id: "github-export",
    area: "Git / GitHub export",
    emergent: "Sync su repo dell'utente (Standard+), push/pull VS Code.",
    fenix:
      "GitHub App server-only (Contents + Metadata): install/connect/status/disconnect owner-bound, cookie HttpOnly CSRF, nonce UNIQUE SQL. Token breve mai persistito. Export Git Data API blob→tree→commit→ref force=false su repo esistenti. Pull esplicito repo+branch solo per alberi Fenix: tree non troncato, blob 100644 UTF-8 bounded, fenix.json, byte e checksum verificati; crea uno studio indipendente senza dati, chat, job, deploy o credenziali. ZIP locale resta. Pronto solo con App + DATABASE_URL (migrazione 0003); altrimenti «GitHub non configurato». Niente sync VS Code generico o merge remoto assistito, niente token nel browser.",
    impact: "high",
    cost: "medium",
    slice: "now",
  },
  {
    id: "backend-auth-api",
    area: "Backend / db / auth / API nelle app generate",
    emergent: "Auth (Google), DB, Stripe, API nel primo build.",
    fenix:
      "Fenix.load/save e Fenix.data JSON usano sulle app pubblicate un archivio Postgres cloud-private con cookie HttpOnly, isolamento, corpo bounded e CAS; link viewer/editor revocabili condividono il dataset cross-device. In più, i brief full-stack espliciti esportano un backend Node+SQLite separato con Bearer da variabile d'ambiente, allowlist Origin, CRUD schema-validato, If-Match CAS e burst concorrente reale. Nessun segreto viene generato. Mancano OAuth/magic-link finali, ruoli per-record, database distribuito generato e connettori applicativi.",
    impact: "high",
    cost: "high",
    slice: "next",
  },
  {
    id: "collab",
    area: "Collaborazione",
    emergent: "Workspace condivisi e ruoli (claim 2026; evidenza mista).",
    fenix:
      "Un titolare del progetto/sito. Sulle app pubblicate crea e revoca link viewer/editor per dati condivisi: frammento URL consumato e rimosso prima del fetch pubblico, token hash-only server-side, cookie HttpOnly, revoca immediata, screenshot D/T/M e prova cross-browser. Non è ancora co-editing del codice, presenza o workspace organizzativo.",
    impact: "medium",
    cost: "high",
    slice: "next",
  },
  {
    id: "integrations",
    area: "Integrazioni",
    emergent: "Stripe, GitHub, MCP, pagamenti da un prompt.",
    fenix: "Nessun marketplace. Non si comprano né si inventano chiavi.",
    impact: "medium",
    cost: "high",
    slice: "later",
  },
  {
    id: "observability",
    area: "Osservabilità",
    emergent: "Monitoring di deploy/CI dichiarato; profondità non verificata qui.",
    fenix:
      "Job visuale + release FSM e registro attività per progetto: build, esito, rimborsi, dati, versioni, rami/unioni, publish ed export. Max 64 eventi, testo redatto, metriche allowlist; niente prompt, messaggi, job id o segreti. Pannello D/T/M con riepilogo esiti/crediti ed export diagnostico JSON privo di identità, codice e dati. Il data service ha un test bounded multi-soggetto/CAS. Dopo ogni CI main verde, production-smoke attende lo SHA Netlify esatto e misura root, asset, Edge e Railway con SLO 8s; niente APM centralizzato e niente carico sul DB produzione non configurato.",
    impact: "medium",
    cost: "medium",
    slice: "next",
  },
  {
    id: "durable-jobs",
    area: "Job durevoli / scalabilità",
    emergent: "Agenti lunghi su pod; crediti bruciati se il prompt è vago.",
    fenix: "Job visuale su worker, claim/lease release, overlay ≤45s. Quota crediti locale.",
    impact: "medium",
    cost: "medium",
    slice: "later",
  },
  {
    id: "quality",
    area: "Qualità generata",
    emergent: "Agente di test che ripara; output lento (45–60 min in prove terze).",
    fenix:
      "Contratto di build v1 (planner deterministico, 0 token) + ruoli grok-build-0.1 con ricevute, niente CoT. Evaluator su 6 fixture: gestionale CRUD, mobile, multi-file, utility, gioco e portfolio; 18 percorsi funzionali D/T/M con console, overflow, focus e target misurati. Gate condiviso API/Edge: blocking ContractCheck ferma t:ok/ready/Pubblica. File extra solo se il brief li chiede. AA fail-closed. Critic LLM saltato se i gate statici passano. Repair max 2. Collection Fenix.data: solo [A-Za-z0-9._-]{1,80}; Vesti «capi vesti» è rifiutata, planner «capi», patch su nodo assente interrotte. Ledger in quality-ledger.ts.",
    impact: "high",
    cost: "medium",
    slice: "now",
  },
  {
    id: "onboarding-deploy",
    area: "Onboarding e deploy",
    emergent: "Hosting incluso, dominio, GitHub gated a pagamento.",
    fenix: "Pubblica web (snapshot + Netlify) e pipeline iOS/Android. Serve HTML valido.",
    impact: "medium",
    cost: "low",
    slice: "later",
  },
];

export function fase3NowGaps(): Fase3Gap[] {
  return FASE3_GAPS.filter((g) => g.slice === "now");
}
