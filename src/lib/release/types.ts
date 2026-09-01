export const PLATFORMS = ["web", "ios", "android"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const RELEASE_STEPS = [
  "connect",
  "configure",
  "preflight",
  "build",
  "sign",
  "upload",
  "processing",
  "ready",
] as const;
export type ReleaseStep = (typeof RELEASE_STEPS)[number];

export type ReleaseStatus = "queued" | "run" | "ok" | "err";

export type TrackState = {
  platform: Platform;
  step: ReleaseStep;
  status: ReleaseStatus;
  fixture: boolean;
  artifact?: string;
  error?: string;
  uploads: number;
};

export type ReleaseConfig = {
  bundleId: string;
  packageName: string;
  siteName: string;
  appName: string;
};

export type AccountStatus = {
  connected: boolean;
  fixture: boolean;
  role: string;
  needs: string[];
  hint: string;
};

export type ReleaseAccounts = {
  web: AccountStatus;
  ios: AccountStatus;
  android: AccountStatus;
  fixture: boolean;
  reviewNote: string;
};

export type StoredReleaseJob = {
  id: string;
  projectId: string;
  ownerHash: string;
  platforms: Platform[];
  status: ReleaseStatus;
  step: ReleaseStep;
  log: string[];
  tracks: Record<Platform, TrackState>;
  config: ReleaseConfig;
  htmlHash: string;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  kind: string;
  name: string;
  tagline: string;
  summary: string;
  html: string;
  palette: {
    bg: string;
    surface: string;
    fg: string;
    muted: string;
    accent: string;
    line?: string;
  };
};

/** Public GET. Never ownerHash, never html (too big / not needed), never secrets. */
export type PublicReleaseJob = {
  id: string;
  projectId: string;
  platforms: Platform[];
  status: ReleaseStatus;
  step: ReleaseStep;
  log: string[];
  tracks: Partial<Record<Platform, Omit<TrackState, never>>>;
  config: ReleaseConfig;
  createdAt: number;
  updatedAt: number;
  error?: string;
  name: string;
  reviewNote: string;
};

export type ReleaseInput = {
  projectId?: unknown;
  platforms?: unknown;
  name?: unknown;
  tagline?: unknown;
  kind?: unknown;
  summary?: unknown;
  palette?: unknown;
  html?: unknown;
  bundleId?: unknown;
  packageName?: unknown;
  siteName?: unknown;
  idempotencyKey?: unknown;
};

export const REVIEW_NOTE =
  "TestFlight e il canale internal di Play si raggiungono in automatico. La scheda pubblica su App Store e Play Store resta soggetta a review.";

export const RELEASE_STORE = "fenix-release-jobs";
