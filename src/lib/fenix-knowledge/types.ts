import type { ProjectKind } from "../projects/types.ts";

export const KNOWLEDGE_CATEGORIES = [
  "architecture",
  "ui-patterns",
  "auth",
  "database",
  "api",
  "ai-features",
  "marketplace",
  "admin",
  "mobile",
  "golden-projects",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export type CategoryStatus = "seeded" | "scaffold" | "empty";

export type KnowledgeSeverity = "must" | "should" | "never" | "scaffold";

export type KnowledgeRule = {
  id: string;
  title: string;
  severity: KnowledgeSeverity;
  statement: string;
  mustNot?: string[];
};

export type KnowledgePack = {
  id: string;
  category: KnowledgeCategory;
  title: string;
  extractNotClone: true;
  teacher?: string;
  appliesWhen: string[];
  rules: KnowledgeRule[];
  status?: CategoryStatus;
  plannedIngest?: number;
  note?: string;
};

export type KnowledgeCategoryMeta = {
  id: KnowledgeCategory;
  status: CategoryStatus;
  title: string;
};

export type KnowledgeIndex = {
  version: number;
  extractNotClone: true;
  completenessRetryThreshold: number;
  categories: KnowledgeCategoryMeta[];
  packs: KnowledgePack[];
};

export type KnowledgeConsult = {
  brief: string;
  kind: ProjectKind;
  categories: KnowledgeCategory[];
  packs: { id: string; category: KnowledgeCategory; title: string }[];
  rules: KnowledgeRule[];
  instruction: string;
};

export const DEFAULT_COMPLETENESS_THRESHOLD = 90;

export type ReviewDimension = "ui" | "mobile" | "architecture" | "completeness";

export type ReviewScores = Record<ReviewDimension, number>;

export type FenixReview = {
  scores: ReviewScores;
  threshold: number;
  retry: boolean;
  findings: string[];
  retryInstruction: string;
};

export type BuildReviewGate = {
  review: FenixReview;
  retry: boolean;
  instruction: string;
  log: string;
};
