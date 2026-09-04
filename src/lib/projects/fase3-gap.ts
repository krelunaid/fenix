/**
 * Fase 3 gap matrix vs Emergent (2026 product, not brochure parity).
 * Current first-party claims and the explicit no-parity verdict are tracked in
 * emergent-competitive-benchmark.ts. Fenix is measured from repository tests.
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
      "Albero POSIX durevole: ingest (no .., no assoluti, no secret/binari, 48 file / 1.5MB). Entrypoint index.html, migrazione HTML-only senza perdere kind/storage/publish. ZIP+fenix.json esportabile e reimportabile in uno studio indipendente: solo entry UTF-8 non compresse, checksum e manifest/file verificati, gate anteprima prima di ready. Studio ispeziona l'albero D/T/M. CSS/JS locali esplicitamente referenziati e dati fetch vengono assemblati in un artifact validabile. Un brief full-stack esplicito include un manifest schema e Fenix materializza nel tree un backend Node+SQLite avviabile sulla stessa origine del frontend, con package, schema, migrazioni versionate forward-only, health e fenix.deploy.json; codice server arbitrario del modello non prevale. Resta un singolo nodo SQLite, senza database distribuito generato.",
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
      "Fenix.load/save e Fenix.data JSON usano sulle app pubblicate un archivio Postgres cloud-private con cookie HttpOnly, isolamento, corpo bounded e CAS; link viewer/editor revocabili condividono il dataset cross-device. In più, i brief full-stack espliciti esportano un backend Node+SQLite accoppiato al frontend sulla stessa origine, con signup/login email-password scrypt, sessioni opache hash-only HttpOnly, recupero password enumeration-safe e accesso passwordless magic-link/OTP (token e OTP solo hash, one-shot, TTL bounded, outbox SQLite senza SMTP), isolamento record per utente, Bearer server-to-server, allowlist Origin, CRUD schema-validato, If-Match CAS, burst concorrente reale e migrazioni v1→v4 senza perdita dati. Nessun segreto viene generato. Mancano OAuth/OIDC social, ruoli granulari per-record, database distribuito generato e connettori applicativi a pagamento.",
    impact: "high",
    cost: "high",
    slice: "next",
  },
  {
    id: "collab",
    area: "Collaborazione",
    emergent: "Workspace condivisi e ruoli (claim 2026; evidenza mista).",
    fenix:
      "Workspace progetto: il titolare crea uno studio condiviso, invita e revoca viewer/editor. I ruoli vivono solo sul server (hash identità, mai ruolo dal browser). Il viewer legge albero e appunti; editor e titolare modificano file con If-Match CAS e un documento testuale con insert/delete server-authoritative (op id, base/versione, idempotenza, ordine stabile). Parti indipendenti convergono; stale o non trasformabili falliscono chiusi. Presenza bounded/TTL e registro redatto (max 64, senza payload). Serve DATABASE_URL con le migrazioni 0006–0007; senza archivio durevole la collaborazione resta 503. Non è un CRDT su ogni file né un workspace organizzativo SSO.",
    impact: "medium",
    cost: "high",
    slice: "now",
  },
  {
    id: "integrations",
    area: "Integrazioni",
    emergent: "Stripe, GitHub, MCP, pagamenti da un prompt.",
    fenix:
      "GitHub App più catalogo server-only di sette famiglie: Drive, Gmail, Calendar, Outlook, Outlook Calendar, Teams e MCP. Il gate limita ogni tool al grant; bearer fuori da browser/body/artifact; nomi, JSON, profondità, nodi, byte e catalog id sono bounded e fail-closed. Testa tutte le famiglie con gate mock. Mancano pagamenti e marketplace amministrabile; non si comprano né si inventano chiavi.",
    impact: "medium",
    cost: "high",
    slice: "now",
  },
  {
    id: "observability",
    area: "Osservabilità",
    emergent: "Monitoring di deploy/CI dichiarato; profondità non verificata qui.",
    fenix:
      "Job visuale + release FSM e registro attività per progetto: build, esito, rimborsi, dati, versioni, rami/unioni, publish ed export. Max 64 eventi, testo redatto, metriche allowlist; niente prompt, messaggi, job id o segreti. Pannello D/T/M con riepilogo esiti/crediti ed export diagnostico JSON privo di identità, codice e dati. Il data service ha un test bounded multi-soggetto/CAS. Un job CI blocking su postgres:16 applica le migrazioni reali, misura carico/CAS/isolamento/idempotenza con p95/p99 e un recovery drill pg_dump/pg_restore major 16; dopo ogni CI main verde, production-smoke attende lo SHA Netlify esatto e misura root, asset, Edge e Railway con SLO 8s. Niente APM centralizzato e niente carico sul database di produzione.",
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
      "Contratto di build v1 (planner deterministico, 0 token) + ruoli grok-build-0.1 con ricevute, niente CoT. Evaluator su 6 fixture storiche, tre geometrici rifiutati, dieci prodotti premium (5 brief × 2) e una regressione Essenza. Pipeline deterministica prompt→plan→generate→visual→QA su sei brief difficili (Essenza, Vesti, ospitalità, ristorazione, dashboard, portfolio) con tre coppie di direzioni diverse: grammatica di layout, token dal brief, imagery di dominio, desktop editoriale. Gate grafico blocking: densità, originalità anti-clone, card-clone, canvas boxed, empty-state, D/T/M screenshot; compilare non basta per ready/pubblica. Direzione grafica esplicita (system/iPhone-like primario, serif da rivista, tab Home/Aggiungi/Persona se richieste) conservata dopo repair mock e prepareSrcDoc; dominio invariato se non chiesto. Protocollo cieco a 10 criteri; benchmark esterno non disponibile. AA fail-closed. Critic LLM saltato se i gate (incluso grafico) passano. Repair max 2. Collection Fenix.data ristretta. Ledger in quality-ledger.ts. Nessun confronto testa-a-testa con Emergent.",
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
