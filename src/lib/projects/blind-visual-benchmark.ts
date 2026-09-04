/**
 * Blind visual benchmark protocol.
 *
 * The judge never receives a producer name. Ordering is a deterministic
 * shuffle of the brief seed. Scores come from painted/source evidence
 * mapped onto an explicit rubric — not a self-assigned vote of parity
 * with Emergent, and not a tautological remap of the graphic gate.
 *
 * External competitor outputs are not in this repository. The protocol
 * therefore records `benchmark esterno non disponibile` and refuses to
 * conclude parity or superiority.
 */
import { briefSeed } from "./design-tokens.ts";
import {
  auditGraphicQuality,
  type GraphicAxis,
  type GraphicReport,
  type RenderedGraphicMetrics,
} from "./graphic-quality.ts";

export const BLIND_RUBRIC = [
  { id: "hierarchy", label: "Gerarchia" },
  { id: "composition", label: "Composizione" },
  { id: "density", label: "Densità utile" },
  { id: "imagery", label: "Imagery di dominio" },
  { id: "originality", label: "Originalità" },
  { id: "typography", label: "Tipografia" },
  { id: "color", label: "Colore" },
  { id: "controls", label: "Controllo/micro-interazione" },
  { id: "responsive", label: "Responsive" },
  { id: "a11y", label: "Accessibilità" },
] as const;

export type RubricId = (typeof BLIND_RUBRIC)[number]["id"];

export type BlindCriterionScore = {
  id: RubricId;
  label: string;
  score: number;
  motivation: string;
};

export type BlindCandidateScore = {
  slot: "A" | "B";
  criteria: BlindCriterionScore[];
  total: number;
};

export type BlindTrial = {
  briefId: string;
  brief: string;
  seed: number;
  order: ["A", "B"];
  mapping: { A: string; B: string };
  labels: { A: "Candidate A"; B: "Candidate B" };
  scores: { A: BlindCandidateScore; B: BlindCandidateScore };
};

export type ExternalBenchmark = {
  available: false;
  declaration: "benchmark esterno non disponibile";
  referenceSet: "none";
  note: string;
};

const AXIS_FOR: Record<RubricId, GraphicAxis> = {
  hierarchy: "hierarchy",
  composition: "density",
  density: "density",
  imagery: "imagery",
  originality: "originality",
  typography: "originality",
  color: "color",
  controls: "controls",
  responsive: "responsive",
  a11y: "a11y",
};

export type VisualEvidence = {
  domain: boolean;
  parts: number;
  semantic: number;
  displayFace: boolean;
  bodyFace: boolean;
  typeRamp: boolean;
  inkQuiet: boolean;
  focus: boolean;
  mq768: boolean;
  mq1024: boolean;
  hover: boolean;
  active: boolean;
  navUnique: number;
  grammar: boolean;
  sparkVaried: boolean;
  forbiddenFallback: boolean;
  headings: number;
  emptyShell: boolean;
};

export function collectVisualEvidence(html: string): VisualEvidence {
  const h = String(html || "");
  const nav = [...h.matchAll(/<svg[^>]*data-craft-nav="1"[^>]*>[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  const semantic =
    (h.match(/data-garment=/g) || []).length +
    (h.match(/data-dish=/g) || []).length +
    (h.match(/data-scene=/g) || []).length +
    (h.match(/data-room=/g) || []).length +
    (h.match(/data-bottle=/g) || []).length +
    (h.match(/data-tool=/g) || []).length;
  return {
    domain: /data-imagery="domain"|data-imagery=\\"domain\\"/.test(h),
    parts: (h.match(/data-part=/g) || []).length,
    semantic,
    displayFace: /--display:/.test(h),
    bodyFace: /--body:/.test(h),
    typeRamp: /--t-h1:/.test(h) && /--t-h2:/.test(h),
    inkQuiet: /--ink-quiet:/.test(h) || /color-mix\(in srgb,var\(--muted\)/.test(h),
    focus: /:focus-visible/.test(h),
    mq768: /@media\(min-width:768px\)/.test(h),
    mq1024: /@media\(min-width:1024px\)/.test(h),
    hover: /:hover/.test(h),
    active: /:active|:focus-visible/.test(h) && /transform:translateY/.test(h),
    navUnique: new Set(nav).size,
    grammar:
      /grid-row:1 \/ span 2/.test(h) ||
      /data-fenix-craft-desk/.test(h) ||
      /header\.mast/.test(h) ||
      /split-stage/.test(h) ||
      /lookbook/.test(h),
    sparkVaried: /function spark\(seed/.test(h) || /data-spark=/.test(h) || !/height:40%/.test(h),
    forbiddenFallback: /#101114|#e1693f/.test(h),
    headings: (h.match(/<h[1-3]\b/g) || []).length,
    emptyShell: /Ciao/.test(h) || /fk-appicon/.test(h) || /width:min\(1080px/.test(h),
  };
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function criterionScore(report: GraphicReport, html: string, id: RubricId): BlindCriterionScore {
  const axis = AXIS_FOR[id];
  const hits = report.findings.filter((f) => f.axis === axis);
  const fail = hits.find((f) => f.severity === "fail");
  const warn = hits.find((f) => f.severity === "warn");
  const ev = collectVisualEvidence(html);
  let score = 4;
  let motivation = "Evidenza visiva insufficiente sul criterio.";
  if (id === "hierarchy") {
    score = 3 + (ev.headings >= 2 ? 2 : 0) + (ev.typeRamp ? 2 : 0) + (ev.inkQuiet ? 2 : 0) + (ev.displayFace ? 1 : 0);
    motivation = ev.typeRamp
      ? "Scala h1/h2 e inchiostro quiete/forte dichiarati nel CSS."
      : ev.headings >= 2
        ? "Titoli presenti, scala tipografica incompleta."
        : "Gerarchia di titoli assente o piatta.";
  } else if (id === "composition") {
    score = 3 + (ev.grammar ? 4 : 0) + (ev.mq1024 ? 2 : 0) + (ev.emptyShell ? -2 : 1);
    motivation = ev.grammar
      ? "Composizione device-aware con lastre/featured plate o desk."
      : "Layout ancora da scheletro, senza grammatica di mestiere.";
  } else if (id === "density") {
    const rows = report.findings.some((f) => f.code === "dead-zone-render");
    score = rows ? 3 : 5 + (ev.headings >= 3 ? 2 : 0) + (ev.semantic > 0 ? 2 : 0);
    motivation = rows
      ? "Zona morta misurata nel main."
      : ev.semantic > 0
        ? "Densità utile: voci, lastre o KPI con soggetto di dominio."
        : "Pochi contenuti utili visibili.";
  } else if (id === "imagery") {
    score = (ev.domain ? 5 : 2) + Math.min(3, Math.floor(ev.parts / 8)) + (ev.semantic >= 3 ? 2 : ev.semantic > 0 ? 1 : 0);
    motivation = ev.semantic >= 3
      ? "Imagery di dominio con parti semantiche (garment/dish/scene/room/bottle)."
      : ev.domain
        ? "SVG di dominio presente, semantica ancora debole."
        : "Niente imagery di dominio, soggetto geometrico o assente.";
  } else if (id === "originality") {
    score = 3 + (ev.navUnique >= 4 ? 3 : ev.navUnique >= 2 ? 1 : 0) + (ev.sparkVaried ? 1 : 0) + (ev.semantic >= 3 ? 2 : 0) + (ev.emptyShell ? -2 : 1);
    motivation = ev.navUnique >= 4
      ? "Set di icone nav distinti e soggetto non riciclato."
      : "Icone o lastre ancora riciclate dal fallback.";
  } else if (id === "typography") {
    score = 3 + (ev.displayFace && ev.bodyFace ? 3 : 0) + (ev.typeRamp ? 3 : 0) + (ev.inkQuiet ? 1 : 0);
    motivation = ev.typeRamp
      ? "Due famiglie e rampa h1/h2/body nel foglio del prodotto."
      : ev.displayFace
        ? "Display dichiarato, rampa incompleta."
        : "Tipografia di sistema, senza rampa.";
  } else if (id === "color") {
    score = ev.forbiddenFallback ? 2 : 5 + (ev.inkQuiet ? 2 : 0) + (ev.domain ? 2 : 0);
    motivation = ev.forbiddenFallback
      ? "Palette di fallback proibita visibile."
      : ev.inkQuiet
        ? "Inchiostri distinti per titolo, nota e kicker."
        : "Pochi inchiostri, gerarchia cromatica debole.";
  } else if (id === "controls") {
    score = 3 + (ev.hover ? 2 : 0) + (ev.active ? 2 : 0) + (/data-state/.test(html) ? 2 : 0) + (/state-empty/.test(html) ? 1 : 0);
    motivation = ev.hover && ev.active
      ? "Hover, press e stati empty/loading dichiarati."
      : "Micro-interazione assente o solo hover.";
  } else if (id === "responsive") {
    score = 3 + (ev.mq768 ? 3 : 0) + (ev.mq1024 ? 3 : 0) + (ev.grammar ? 1 : 0);
    motivation = ev.mq768 && ev.mq1024
      ? "Breakpoint tablet e desktop con chrome device-aware."
      : "Un solo layout, non device-aware.";
  } else if (id === "a11y") {
    score = 3 + (ev.focus ? 4 : 0) + (/aria-label/.test(html) ? 2 : 0) + (/lang="it"/.test(html) ? 1 : 0);
    motivation = ev.focus
      ? "Focus visibile e etichette aria sul mestiere."
      : "Focus visibile assente.";
  }
  if (fail) {
    score = Math.min(score, 3);
    motivation = fail.summary;
  } else if (warn) {
    score = Math.min(score, Math.max(5, score - 1));
    if (motivation.length < 12) motivation = warn.summary;
  }
  score = clampScore(score);
  const forbidden = /fenix|emergent|apple|kreluna|grok/i;
  if (forbidden.test(motivation)) motivation = "Rilievo visivo sul criterio, senza attributo di produttore.";
  return { id, label: BLIND_RUBRIC.find((r) => r.id === id)!.label, score, motivation };
}

export function scoreUnlabeled(
  html: string,
  brief: string,
  rendered?: RenderedGraphicMetrics,
): BlindCandidateScore {
  const report = auditGraphicQuality(html, { brief, rendered });
  const criteria = BLIND_RUBRIC.map((row) => criterionScore(report, html, row.id));
  const total = criteria.reduce((s, c) => s + c.score, 0);
  return { slot: "A", criteria, total };
}

export function shufflePair(brief: string, leftId: string, rightId: string): { A: string; B: string; swapped: boolean } {
  const swapped = briefSeed(brief) % 2 === 1;
  return swapped
    ? { A: rightId, B: leftId, swapped: true }
    : { A: leftId, B: rightId, swapped: false };
}

export function runBlindTrial(input: {
  briefId: string;
  brief: string;
  left: { id: string; html: string };
  right: { id: string; html: string };
  rendered?: { left?: RenderedGraphicMetrics; right?: RenderedGraphicMetrics };
}): BlindTrial {
  const pair = shufflePair(input.brief, input.left.id, input.right.id);
  const byId: Record<string, { id: string; html: string }> = {
    [input.left.id]: input.left,
    [input.right.id]: input.right,
  };
  const a = byId[pair.A]!;
  const b = byId[pair.B]!;
  const scoreA = scoreUnlabeled(
    a.html,
    input.brief,
    pair.swapped ? input.rendered?.right : input.rendered?.left,
  );
  const scoreB = scoreUnlabeled(
    b.html,
    input.brief,
    pair.swapped ? input.rendered?.left : input.rendered?.right,
  );
  scoreA.slot = "A";
  scoreB.slot = "B";
  return {
    briefId: input.briefId,
    brief: input.brief,
    seed: briefSeed(input.brief),
    order: ["A", "B"],
    mapping: { A: pair.A, B: pair.B },
    labels: { A: "Candidate A", B: "Candidate B" },
    scores: { A: scoreA, B: scoreB },
  };
}

export const EXTERNAL_BENCHMARK: ExternalBenchmark = {
  available: false,
  declaration: "benchmark esterno non disponibile",
  referenceSet: "none",
  note: "Nessun output Emergent equivalente è depositato nel repository e non si acquistano piani o workspace per ottenerlo. Il protocollo cieco gira su artifact interni (legacy geometrico vs riferimento premium originale). Non conclude parità né superiorità.",
};

export function blindProtocolVerdict(trials: BlindTrial[]) {
  return {
    trials: trials.length,
    rubric: BLIND_RUBRIC.map((r) => r.id),
    external: EXTERNAL_BENCHMARK,
    headToHead: "not-run" as const,
    parity: "unproven" as const,
    superiority: "unproven" as const,
    note: "I punteggi per criterio sono del harness interno su evidenza (rampa, imagery semantica, icone, breakpoint). Non sono un voto di parità.",
  };
}