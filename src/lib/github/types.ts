/** Public GitHub export types. No tokens, no PEM, no installation secrets. */

export type GitHubStatus = {
  configured: boolean;
  connected: boolean;
  account?: string;
  hint: string;
};

export type GitHubRepo = {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  empty: boolean;
};

export type ExportFile = {
  path: string;
  bytes: number;
  change?: "add" | "update" | "same";
};

export type PublicExportJob = {
  id: string;
  status: "run" | "ok" | "err";
  repo: string;
  branch: string;
  contentHash: string;
  commitSha?: string;
  unchanged?: boolean;
  htmlUrl?: string;
  files: ExportFile[];
  log: string[];
  error?: string;
};

export type StoredInstallation = {
  ownerHash: string;
  installationId: string;
  account?: string;
  connectedAt: number;
};

export type StoredExportJob = {
  id: string;
  ownerHash: string;
  installationId: string;
  repo: string;
  branch: string;
  contentHash: string;
  gitTreeSha?: string;
  commitSha?: string;
  status: "run" | "ok" | "err";
  unchanged?: boolean;
  htmlUrl?: string;
  files: ExportFile[];
  log: string[];
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export const GITHUB_NOT_CONFIGURED = "GitHub non configurato.";
export const GITHUB_API_VERSION = "2026-03-10";
export const GITHUB_API = "https://api.github.com";
export const GITHUB_STORE = "fenix-github";
