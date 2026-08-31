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
