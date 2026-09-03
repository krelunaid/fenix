import type { ProjectFile } from "./files";

export type ProjectKind = "landing" | "app" | "dashboard" | "tool" | "game" | "site";

export type Palette = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  accent: string;
  line?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: number;
};

export type BuildStatus = "draft" | "building" | "ready" | "error";

export type ProjectActivityKind =
  | "created"
  | "build"
  | "ready"
  | "error"
  | "refund"
  | "data"
  | "restore"
  | "branch"
  | "merge"
  | "publish"
  | "export"
  | "import";

export type ProjectActivityOutcome = "info" | "run" | "ok" | "err";

/** Bounded, redacted operational evidence. Never prompts, messages, job ids or secrets. */
export type ProjectActivity = {
  id: string;
  at: number;
  kind: ProjectActivityKind;
  outcome: ProjectActivityOutcome;
  label: string;
  detail?: string;
  metrics?: Partial<
    Record<"credits" | "files" | "revisions" | "rows" | "durable" | "version" | "conflicts", number>
  >;
};

export type RevisionSource = "create" | "build" | "polish" | "restore" | "manual";

/** Snapshot of the project tree. Never secrets, never job ids, never messages. */
export type ProjectRevision = {
  id: string;
  at: number;
  source: RevisionSource;
  label: string;
  hash: string;
  html: string;
  files: ProjectFile[];
  name: string;
  tagline: string;
  summary: string;
  palette: Palette;
};

export type Project = {
  id: string;
  name: string;
  tagline: string;
  prompt: string;
  kind: ProjectKind;
  /** User-chosen kind at create time. Worker META cannot overwrite it. */
  requestedKind?: ProjectKind;
  summary: string;
  direction?: string;
  palette: Palette;
  html: string;
  files?: ProjectFile[];
  messages: ChatMessage[];
  buildLog: string[];
  status: BuildStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
  demoId?: string;
  /** Railway/visual worker job. Survives reload so polling can reattach. */
  visualJobId?: string;
  visualJobStatus?: "run" | "ok" | "err";
  visualJobStartedAt?: number;
  /** Last syntax-ok preview shown to the user. Restored on a definitive error. */
  lastStableHtml?: string;
  lastStableFiles?: ProjectFile[];
  /** Monotonic generation. Stale SSE/poll cannot apply or refund across it. */
  buildEpoch?: number;
  /** Fenix.load/save collections. Persisted with the project so reload keeps rows. */
  appData?: Record<string, unknown>;
  /** One refund per failed build. Retry spend resets this. */
  creditRefunded?: boolean;
  /** Cotture precedenti. Ripristino sicuro dopo una rifinitura. */
  revisions?: ProjectRevision[];
  /** Id della revisione attualmente in anteprima. */
  revisionId?: string;
  /** Provenienza di un ramo. Solo identificatori locali, mai dati o credenziali. */
  branchFrom?: { projectId: string; revisionId: string };
  /** Registro operativo locale, redatto e limitato. Non viene copiato nei rami. */
  activity?: ProjectActivity[];
  /** Snapshot pubblico dopo una pubblicazione riuscita. Mai inventato. */
  publishedId?: string;
};

export const DEFAULT_PALETTE: Palette = {
  bg: "#16110c",
  surface: "#221c16",
  fg: "#efe6d4",
  muted: "#9a8f7a",
  accent: "#c45c26",
  line: "#3d3428",
};

export type ExampleBrief = {
  id: string;
  label: string;
  kind: ProjectKind;
  prompt: string;
  demoId?: string;
};
