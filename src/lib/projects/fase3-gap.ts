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
    fenix: "Cotture fotografate (html+files). Ripristino CAS, max 16, niente job/secret nel log.",
    impact: "high",
    cost: "medium",
    slice: "now",
  },
  {
    id: "project-tree",
    area: "Progetti multi-file / full-stack",
    emergent: "Albero React/Next + backend Node/FastAPI + Mongo, file veri.",
    fenix: "Albero POSIX durevole: ingest (no .., no assoluti, no secret/binari, 48 file / 1.5MB). Entrypoint index.html, migrazione HTML-only senza perdere kind/storage/publish. ZIP+fenix.json. Studio ispeziona l'albero D/T/M. Preview/publish solo HTML validato. Extra file non eseguiti.",
    impact: "high",
    cost: "high",
    slice: "now",
  },
  {
    id: "github-export",
    area: "Git / GitHub export",
    emergent: "Sync su repo dell'utente (Standard+), push/pull VS Code.",
    fenix: "GitHub App server-only (Contents + Metadata): install/connect/status/disconnect owner-bound, cookie HttpOnly CSRF, nonce UNIQUE SQL. Token breve mai persistito. Export Git Data API blob→tree→commit→ref force=false su repo esistenti. ZIP locale resta. Senza App: «GitHub non configurato». Niente pull VS Code, niente token nel browser.",
    impact: "high",
    cost: "medium",
    slice: "now",
  },
  {
    id: "backend-auth-api",
    area: "Backend / db / auth / API nelle app generate",
    emergent: "Auth (Google), DB, Stripe, API nel primo build.",
    fenix: "Fenix.load/save IndexedDB nel runtime. Auth Fenix è del titolare, non dell'app generata. Mock JSON nel tree, niente server inventato.",
    impact: "high",
    cost: "high",
    slice: "later",
  },
  {
    id: "collab",
    area: "Collaborazione",
    emergent: "Workspace condivisi e ruoli (claim 2026; evidenza mista).",
    fenix: "Un titolare per job/sito. Nessun workspace multi-utente sul progetto.",
    impact: "medium",
    cost: "high",
    slice: "later",
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
    fenix: "Job visuale + release FSM con log redatti. Niente APM sulle app generate.",
    impact: "medium",
    cost: "medium",
    slice: "later",
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
    fenix: "QA HTML, kind-lock, repair boot, polish. Fornace/Officina restano il banco Fase 1.",
    impact: "high",
    cost: "medium",
    slice: "next",
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
