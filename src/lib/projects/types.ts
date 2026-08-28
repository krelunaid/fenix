export type ProjectKind = "landing" | "app" | "dashboard" | "tool" | "game" | "site";

export type Palette = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  accent: string;
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
  summary: string;
  palette: Palette;
  html: string;
  messages: ChatMessage[];
  buildLog: string[];
  status: BuildStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
  demoId?: string;
};

export const DEFAULT_PALETTE: Palette = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  fg: "#1d1d1f",
  muted: "#6e6e73",
  accent: "#1d1d1f",
};

export type ExampleBrief = {
  id: string;
  label: string;
  kind: ProjectKind;
  prompt: string;
  demoId?: string;
};
