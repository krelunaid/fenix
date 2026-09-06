/**
 * Browser-safe embed of fenix-knowledge. Disk JSON is the human store;
 * tests require pack/rule ids to match.
 */
import {
  DEFAULT_COMPLETENESS_THRESHOLD,
  KNOWLEDGE_CATEGORIES,
  type KnowledgeIndex,
  type KnowledgePack,
} from "./types.ts";

const PACKS: KnowledgePack[] = [
  {
    id: "architecture-floor",
    category: "architecture",
    title: "Kind lock and chrome",
    extractNotClone: true,
    appliesWhen: ["always"],
    rules: [
      {
        id: "architecture.kind-lock",
        title: "Prompt kind beats a leftover phone seed",
        severity: "must",
        statement:
          "Dashboard / sito stay desk or masthead. Phone kinds stay tab chrome. A gestionale must not ship a phone seed.",
        mustNot: ["iPhone tabbar on a commercialisti desk"],
      },
      {
        id: "architecture.seed-is-product",
        title: "Seed HTML is the product",
        severity: "should",
        statement:
          "Compose writes a real product seed. Polish refines copy and craft; it does not recycle a generic phone skeleton.",
        mustNot: ["boxed 1080 placeholder", "Ciao/Operatore skeleton"],
      },
    ],
  },
  {
    id: "water-craft",
    category: "ui-patterns",
    title: "Water / field utility craft",
    extractNotClone: true,
    teacher: "AcquaGt (quality only)",
    appliesWhen: ["water", "field", "acqua", "campo", "serbatoio", "bottiglia", "consegne"],
    rules: [
      {
        id: "water-craft.slots",
        title: "Named craft slots, utility rhythm",
        severity: "must",
        statement:
          "Use shared craft slots: surface / onSurface / inverse / brand scale / success / radius 6/12/20 / spacing 4–48. Mode is utility. Paper #F8FAFC, sky brand #0EA5E9 / #0284C7, inverse board #0F172A, success #10B981.",
        mustNot: ["Apple SET #f5f5f7 + #0071e3 / #007AFF", "olive wash from a dark user navy"],
      },
      {
        id: "water-craft.inverse-tank",
        title: "Two inverse cards, glass only on chrome",
        severity: "must",
        statement:
          "Home is greeting-first with two inverse cards, not one mashed shell. Glass only on sticky header, tab bar, and the hero tank — never on fields or rows.",
        mustNot: ["clone AcquaGt screen structure", "glass on every card"],
      },
      {
        id: "water-craft.drop-mark",
        title: "Original filled drop mark",
        severity: "must",
        statement:
          "Campo identity is an original filled water-drop chip on a navy plate. Readable at favicon and 48px.",
        mustNot: ["copyrighted 3D drop asset", "generic briefcase", "pale 18% outline"],
      },
      {
        id: "water-craft.lock-hex",
        title: "Field briefs lock craft hexes",
        severity: "must",
        statement:
          "A dark brief accent (e.g. #0A2F6B) becomes ink/board, not the brand fill. Force a vivid water accent unless the brief already gave one.",
        mustNot: ["user navy as the only color", "barber tan or raspberry on a field product"],
      },
    ],
  },
  {
    id: "barber-corto",
    category: "ui-patterns",
    title: "Barber Corto-level salon booking",
    extractNotClone: true,
    teacher: "Corto (quality only)",
    appliesWhen: ["barber", "parrucchier", "barbiere", "salon", "hair salon"],
    rules: [
      {
        id: "barber-corto.espresso",
        title: "Espresso + cream + tan, never raspberry",
        severity: "must",
        statement:
          "Salon paper is espresso (#0B0908 / #16110E), cream ink (#F4EEE6), tan brand (#D2BFA6). AA tan-on-espresso. Mode is salon, consumer radii.",
        mustNot: ["raspberry #b51246 / #b01e47 / #a61d4c", "water sky #0EA5E9", "pale booking teal"],
      },
      {
        id: "barber-corto.client-ia",
        title: "Client salon IA, not staff KPI",
        severity: "must",
        statement:
          "Tabs Home / Prenota / I miei. Service cards show duration, price, professional. Book flow has visible progress. Editorial serif on display, sans on metadata.",
        mustNot: [
          "staff dashboard Oggi/Nuovo/Settimana/Archivio",
          "0-KPI Oggi/Media/Voci/Aperti in sala",
          "generic Home/Nuovo/Elenco",
        ],
      },
      {
        id: "barber-corto.mark",
        title: "Filled shears chip, original still-life",
        severity: "must",
        statement:
          "Header/favicon use a filled shears chip: tapered cream blades, evenodd donut rings, tan hairline on espresso. Atmosphere art is original SVG still-life.",
        mustNot: [
          "Corto screens or copy",
          "Gentleman Barber",
          "Il dettaglio fa la differenza",
          "pale X outline",
          "exit-door scrap",
          "solid blob rings",
        ],
      },
      {
        id: "barber-corto.definition",
        title: "Crisp hairlines and solid Prenota",
        severity: "must",
        statement:
          "Salon chrome is defined: 1px #4A3C30 hairlines, tight shadows, Fraunces 800 display, Figtree metadata. Prenota CTA has a tan edge, cream inset, and a darker press fill. Less muddy blur on header/tabs.",
        mustNot: ["soft 18px chrome blur", "borderless Prenota pill", "stock photos"],
      },
      {
        id: "barber-corto.voice",
        title: "In-chair client voice",
        severity: "should",
        statement:
          "Voice is the client in the chair: servizio, durata, prezzo, professionista. Label Taglio. CTA Prenota — not Registra in ledger.",
        mustNot: ["clone Corto layout or photography"],
      },
    ],
  },
  {
    id: "library-editorial",
    category: "ui-patterns",
    title: "Library / bookstore editorial",
    extractNotClone: true,
    teacher: "Fenix bookstore craft",
    appliesWhen: ["library", "librer", "bibliotec", "bookstore", "catalogo libr", "prestit"],
    rules: [
      {
        id: "library-editorial.paper",
        title: "Cream paper, wine brand, editorial type",
        severity: "must",
        statement:
          "Bookstore mode: cream paper #FFF8F0 / #F6EFE4, wine brand #6B2D3C, consumer radii. Editorial display type. Phone craft — not magazine masthead.",
        mustNot: ["desk gray STUDIO", "water sky", "generic studio teal"],
      },
      {
        id: "library-editorial.ia",
        title: "Catalogo, prestiti, scaffali",
        severity: "must",
        statement:
          "IA is shelf + loan + card. Empty: Nessun libro in scaffale. CTA Metti in scaffale. Label Libri.",
        mustNot: ["Tavolo/Registra/Studio", "0-KPI Oggi/Media/Voci/Aperti", "desk ledger chrome"],
      },
      {
        id: "library-editorial.mark",
        title: "Filled book chip",
        severity: "must",
        statement:
          "Home mark is a filled cream book on a navy plate — not a dim scrap outline or exit door.",
        mustNot: ["briefcase", "shears", "water drop"],
      },
    ],
  },
  {
    id: "premium-default-floor",
    category: "ui-patterns",
    title: "Premium-default quality floor",
    extractNotClone: true,
    teacher: "Fenix graphic + native floor",
    appliesWhen: ["always"],
    rules: [
      {
        id: "premium-default.aa",
        title: "AA contrast and visible focus",
        severity: "must",
        statement:
          "Text/control contrast ≥ 4.5. :focus-visible on interactive chrome. Selected nav text is foreground-on-surface, not accent-on-tint.",
        mustNot: ["accent-on-tinted-surface nav that fails AA"],
      },
      {
        id: "premium-default.targets",
        title: "Tap targets and type ramp",
        severity: "must",
        statement:
          "Phone: tap targets ≥ 44px, type ramp 12–40 (display up to 46 on luxe), spacing token 8px, tabular figures on numbers. Desk keeps desktop IA — premium is not an iPhone tabbar.",
        mustNot: ["boxed 1080 phone shell on a gestionale", "targets under 24px"],
      },
      {
        id: "premium-default.states",
        title: "Empty / loading / success / error",
        severity: "must",
        statement:
          "Every compose ships visible empty, loading, success, and error states. Motion only with prefers-reduced-motion: no-preference.",
        mustNot: ["Nessun elemento as the only empty copy", "leaked undefined/null/NaN"],
      },
      {
        id: "premium-default.original",
        title: "Original marks, no clone set",
        severity: "must",
        statement:
          "Sector pictograms are original. Filled navy chips for utility/editorial/ops. No placeholder geometry, no hotlinked Unsplash/Apple/Emergent bitmaps.",
        mustNot: ["#f5f5f7 + #0071e3 + San Francisco as a set", "Ciao / Operatore generic chrome"],
      },
    ],
  },
  {
    id: "auth-scaffold",
    category: "auth",
    title: "Auth scaffold",
    extractNotClone: true,
    appliesWhen: ["login", "signup", "auth", "password", "oauth"],
    rules: [
      {
        id: "auth.scaffold",
        title: "Do not invent a full auth stack yet",
        severity: "scaffold",
        statement:
          "Slice 1 records the category. A brief that asks for login must not leak secrets into HTML. Full auth/payments land in a later slice.",
        mustNot: ["API keys in generated HTML"],
      },
    ],
  },
  {
    id: "database-scaffold",
    category: "database",
    title: "Database scaffold",
    extractNotClone: true,
    appliesWhen: ["database", "sqlite", "postgres", "collection", "crud"],
    rules: [
      {
        id: "database.scaffold",
        title: "Named collections, no leaked runtime text",
        severity: "scaffold",
        statement:
          "When a brief needs data, use a named Fenix collection and visible empty/error states. Do not print undefined/null/NaN.",
        mustNot: ["localStorage as the only durable store when a backend is required"],
      },
    ],
  },
  {
    id: "api-scaffold",
    category: "api",
    title: "API scaffold",
    extractNotClone: true,
    appliesWhen: ["api", "backend", "endpoint", "full-stack"],
    rules: [
      {
        id: "api.scaffold",
        title: "Same-origin, no eval, no secrets",
        severity: "scaffold",
        statement:
          "A full-stack brief may add a portable Node API on the same origin. No eval, no secrets in the tree.",
        mustNot: ["eval", "iframe allow-same-origin sandbox holes"],
      },
    ],
  },
  {
    id: "ai-features-scaffold",
    category: "ai-features",
    title: "AI features scaffold",
    extractNotClone: true,
    appliesWhen: ["ai", "llm", "chatbot", "teleprompter"],
    rules: [
      {
        id: "ai-features.no-clone-wizard",
        title: "Do not clone teacher AI wizards",
        severity: "scaffold",
        statement:
          "If a brief asks for AI, ship an original flow. Do not copy ActStage Scene Wizard, teleprompter, or LikeSwift chat.",
        mustNot: ["cloned teacher chat or teleprompter"],
      },
    ],
  },
  {
    id: "marketplace-scaffold",
    category: "marketplace",
    title: "Marketplace scaffold",
    extractNotClone: true,
    appliesWhen: ["marketplace", "lavoretti", "incarichi", "tasker", "gig"],
    rules: [
      {
        id: "marketplace.chips",
        title: "Category chips, consumer rhythm",
        severity: "scaffold",
        statement:
          "Micro-task briefs use consumer radii, navy brand, category chips. Tabs stay Incarichi — not Tracking/Chat.",
        mustNot: ["LikeSwift Chat or Tracking screens", "water sky on a lavoretti brief"],
      },
    ],
  },
  {
    id: "admin-scaffold",
    category: "admin",
    title: "Admin / desk scaffold",
    extractNotClone: true,
    appliesWhen: ["dashboard", "gestionale", "admin", "commercialist"],
    rules: [
      {
        id: "admin.desk",
        title: "Desk IA for gestionali",
        severity: "scaffold",
        statement:
          "Dashboard kind: header + filters + table + form. Desk radii 6/10/14. Light professional paper unless the brief asks midnight.",
        mustNot: ["phone tabbar on a desk product"],
      },
    ],
  },
  {
    id: "mobile-floor",
    category: "mobile",
    title: "Phone chrome floor",
    extractNotClone: true,
    appliesWhen: ["phone", "app", "tool", "game"],
    rules: [
      {
        id: "mobile.phone-chrome",
        title: "Tab chrome and 44px targets",
        severity: "must",
        statement:
          "Phone kinds: bottom tabs, ≥44px targets, no min-width desktop, no overflow-x. Native style layer only when the brief asks stile Apple / iPhone / iOS.",
        mustNot: ["Apple skin on every shop brief", "desktop min-width on an app"],
      },
    ],
  },
  {
    id: "golden-projects",
    category: "golden-projects",
    title: "Golden project ingest",
    extractNotClone: true,
    appliesWhen: [],
    plannedIngest: 10,
    note: "Ingest extracts reusable patterns by category. Never clone screens, chat, wizards, or assets.",
    rules: [],
  },
];

export function catalogKnowledge(): KnowledgeIndex {
  return {
    version: 1,
    extractNotClone: true,
    completenessRetryThreshold: DEFAULT_COMPLETENESS_THRESHOLD,
    categories: [
      { id: "architecture", status: "scaffold", title: "Architecture" },
      { id: "ui-patterns", status: "seeded", title: "UI patterns" },
      { id: "auth", status: "scaffold", title: "Auth" },
      { id: "database", status: "scaffold", title: "Database" },
      { id: "api", status: "scaffold", title: "API" },
      { id: "ai-features", status: "scaffold", title: "AI features" },
      { id: "marketplace", status: "scaffold", title: "Marketplace" },
      { id: "admin", status: "scaffold", title: "Admin" },
      { id: "mobile", status: "scaffold", title: "Mobile" },
      { id: "golden-projects", status: "empty", title: "Golden projects" },
    ],
    packs: PACKS,
  };
}

export function catalogPackIds(): string[] {
  return PACKS.map((p) => p.id);
}

export { KNOWLEDGE_CATEGORIES };
