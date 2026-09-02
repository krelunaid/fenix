/**
 * Blind visual benchmark protocol.
 *
 * The judge never receives a producer name. Ordering is a deterministic
 * shuffle of the brief seed. Scores come from the graphic gate mapped onto
 * an explicit rubric — not a self-assigned vote of parity with Emergent.
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

function criterionScore(report: GraphicReport, id: RubricId): BlindCriterionScore {
  const axis = AXIS_FOR[id];
  const hits = report.findings.filter((f) => f.axis === axis);
  const fail = hits.find((f) => f.severity === "fail");
  const warn = hits.find((f) => f.severity === "warn");
  const pass = hits.find((f) => f.severity === "pass");
  let score = 8;
  let motivation = pass?.summary || "Nessun rilievo sul criterio.";
  if (fail) {
    score = 3;
    motivation = fail.summary;
  } else if (warn) {
    score = 6;
    motivation = warn.summary;
  }
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
  const criteria = BLIND_RUBRIC.map((row) => criterionScore(report, row.id));
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
    note: "I punteggi per criterio sono del harness interno. Non sono un voto di parità.",
  };
}
