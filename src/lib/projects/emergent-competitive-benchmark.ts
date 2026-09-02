/**
 * Competitive evidence map against Emergent's current first-party claims.
 *
 * Important: this is not a product ranking. `emergentClaimed` is sourced from
 * Emergent's own public pages; it is not treated as independently verified.
 * Parity or superiority requires the same prompts, budgets and acceptance
 * harness to run on both products.
 */
export type CompetitiveStatus = "demonstrated" | "partial" | "gap";

export type CompetitiveSource = {
  id: string;
  title: string;
  url: string;
  retrieved: "2026-09-02";
};

export type CompetitiveAxis = {
  id:
    | "multi-file-full-stack"
    | "backend-auth-data-api"
    | "iteration-rollback-branching"
    | "git-portability"
    | "collaboration-roles"
    | "integrations-connectors"
    | "observability-costs"
    | "durable-jobs-scale"
    | "generated-quality"
    | "onboarding-web-mobile";
  label: string;
  status: CompetitiveStatus;
  emergentClaimed: string;
  fenixEvidence: string;
  remainingGap: string;
  sourceIds: string[];
  headToHeadRun: false;
};

export const EMERGENT_COMPETITIVE_SOURCES: CompetitiveSource[] = [
  {
    id: "emergent-features",
    title: "Welcome To Emergent — Features and tools",
    url: "https://help.emergent.sh/articles/272715-features-and-tools",
    retrieved: "2026-09-02",
  },
  {
    id: "emergent-enterprise",
    title: "Emergent Enterprise",
    url: "https://emergent.sh/enterprise",
    retrieved: "2026-09-02",
  },
  {
    id: "emergent-web-mobile",
    title: "Emergent Web ↔ Mobile",
    url: "https://help.emergent.sh/web-mobile",
    retrieved: "2026-09-02",
  },
  {
    id: "emergent-web-builder",
    title: "Emergent AI Web App Builder",
    url: "https://emergent.sh/ai-web-app-builder",
    retrieved: "2026-09-02",
  },
];

export const EMERGENT_COMPETITIVE_AXES: CompetitiveAxis[] = [
  {
    id: "multi-file-full-stack",
    label: "Progetti multi-file / full-stack",
    status: "partial",
    emergentClaimed: "Frontend, backend, database e deploy generati end-to-end.",
    fenixEvidence:
      "Tree POSIX, runtime multi-file, ZIP round-trip e backend Node+SQLite same-origin provati da files.test.ts e portable-backend.test.ts.",
    remainingGap:
      "Nessun confronto dello stesso brief esportato; il backend Fenix generato resta single-node SQLite.",
    sourceIds: ["emergent-features", "emergent-enterprise"],
    headToHeadRun: false,
  },
  {
    id: "backend-auth-data-api",
    label: "Backend / database / auth / API",
    status: "partial",
    emergentClaimed:
      "Auth, database e API inclusi; Google, GitHub, Auth0, email/OTP e più database dichiarati.",
    fenixEvidence:
      "CRUD, CAS, Postgres cloud-private, sessioni HttpOnly, scrypt e recovery one-shot provati da cloud-data.test.ts e portable-backend.test.ts.",
    remainingGap: "OAuth/OIDC, OTP, pagamenti e connettori applicativi non sono ancora coperti.",
    sourceIds: ["emergent-features", "emergent-web-builder"],
    headToHeadRun: false,
  },
  {
    id: "iteration-rollback-branching",
    label: "Iterazione / rollback / branching",
    status: "demonstrated",
    emergentClaimed: "Iterazione conversazionale sul progetto.",
    fenixEvidence:
      "Cotture, rollback CAS, rami isolati e merge three-way fail-closed provati da revisions.test.ts e revisions-browser.test.ts.",
    remainingGap: "Manca il confronto degli stessi cambiamenti complessi sui due prodotti.",
    sourceIds: ["emergent-features"],
    headToHeadRun: false,
  },
  {
    id: "git-portability",
    label: "Git / GitHub / portabilità",
    status: "demonstrated",
    emergentClaimed: "GitHub sync ed esportazione del codice di proprietà dell'utente.",
    fenixEvidence:
      "GitHub App server-only export/pull e ZIP verificato provati da github.test.ts, github-browser.test.ts e files.test.ts.",
    remainingGap: "Nessun round-trip dello stesso progetto generato anche da Emergent.",
    sourceIds: ["emergent-features", "emergent-enterprise"],
    headToHeadRun: false,
  },
  {
    id: "collaboration-roles",
    label: "Collaborazione e ruoli",
    status: "partial",
    emergentClaimed: "Workspace condivisi, ruoli, SSO e audit per team enterprise.",
    fenixEvidence:
      "Owner/editor/viewer, revoca, presenza, CAS e documento simultaneo provati da workspace.test.ts e workspace-browser.test.ts.",
    remainingGap: "Workspace organizzativi, SSO/SAML, amministrazione e crediti condivisi restano assenti.",
    sourceIds: ["emergent-enterprise"],
    headToHeadRun: false,
  },
  {
    id: "integrations-connectors",
    label: "Integrazioni e connettori",
    status: "gap",
    emergentClaimed: "100+ integrazioni/MCP, pagamenti e API esterne dichiarate.",
    fenixEvidence: "GitHub è integrato; nessun marketplace generale viene simulato.",
    remainingGap: "Stripe/Razorpay, MCP e un catalogo di connettori con secret server-only.",
    sourceIds: ["emergent-enterprise", "emergent-web-builder"],
    headToHeadRun: false,
  },
  {
    id: "observability-costs",
    label: "Osservabilità, errori e costi",
    status: "partial",
    emergentClaimed: "Hosting, monitoring, uptime e audit gestiti.",
    fenixEvidence:
      "Ledger redatto, CI, production smoke, SLO e harness PostgreSQL 16 provati da quality-ledger.ts e postgres-reliability.test.ts.",
    remainingGap: "APM centralizzato, uptime storico e cost attribution multi-team non sono presenti.",
    sourceIds: ["emergent-enterprise"],
    headToHeadRun: false,
  },
  {
    id: "durable-jobs-scale",
    label: "Job durevoli, concorrenza e scala",
    status: "partial",
    emergentClaimed: "Agenti coordinati e build parallele per più team.",
    fenixEvidence:
      "Release FSM idempotente, lease, recovery, CAS concorrente e pool bounded provati dalla suite e dal job postgres-16-reliability.",
    remainingGap: "Orchestrazione multi-agent realmente parallela e carico di produzione multi-team.",
    sourceIds: ["emergent-enterprise", "emergent-features"],
    headToHeadRun: false,
  },
  {
    id: "generated-quality",
    label: "Qualità grafica e funzionale generata",
    status: "partial",
    emergentClaimed: "Build e test automatici dalla stessa conversazione.",
    fenixEvidence:
      "Sei prodotti e 18 journey D/T/M con screenshot, console, overflow, focus, target e AA provati da build-contract-browser.test.ts.",
    remainingGap: "Valutazione cieca degli output generati dallo stesso prompt non ancora eseguita.",
    sourceIds: ["emergent-features"],
    headToHeadRun: false,
  },
  {
    id: "onboarding-web-mobile",
    label: "Onboarding e deploy web / iOS / Android",
    status: "partial",
    emergentClaimed: "Web↔mobile in un click con backend, database e login condivisi; deploy app store dichiarato.",
    fenixEvidence:
      "Web production e pipeline iOS/Android con fixture, build Gradle reale e gate store provati dalla Fase 2.",
    remainingGap:
      "Conversione web↔mobile collegata allo stesso backend non esiste; TestFlight/Play reali richiedono account esterni.",
    sourceIds: ["emergent-web-mobile", "emergent-enterprise"],
    headToHeadRun: false,
  },
];

export function competitiveBenchmarkVerdict() {
  const counts = { demonstrated: 0, partial: 0, gap: 0 };
  for (const axis of EMERGENT_COMPETITIVE_AXES) counts[axis.status] += 1;
  return {
    axes: EMERGENT_COMPETITIVE_AXES.length,
    counts,
    headToHead: "not-run" as const,
    parity: "unproven" as const,
    superiority: "unproven" as const,
  };
}
