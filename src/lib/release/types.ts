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

/** Provider operation ids. Never secrets. Persist before/during side effects. */
export type ProviderIds = {
  appId?: string;
  archivePath?: string;
  ipaPath?: string;
  aabPath?: string;
  signedAabPath?: string;
  uploadId?: string;
  buildId?: string;
  editId?: string;
  versionCode?: string;
  siteId?: string;
  deployId?: string;
  intentId?: string;
};

export type TrackState = {
  platform: Platform;
  step: ReleaseStep;
  status: ReleaseStatus;
  fixture: boolean;
  artifact?: string;
  error?: string;
  uploads: number;
  provider?: ProviderIds;
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
  leaseOwner?: string;
  leaseUntil?: number;
};

/** Public GET. Never ownerHash, never html, never secrets, never lease. */
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

export type PersistTrack = (patch: Partial<TrackState>) => Promise<TrackState>;

export type AdapterResult = {
  ok: boolean;
  step: ReleaseStep;
  artifact?: string;
  error?: string;
  fixture: boolean;
  pending?: boolean;
  reconciled?: boolean;
};

export const REVIEW_NOTE =
  "TestFlight e il canale internal di Play si raggiungono in automatico. La scheda pubblica su App Store e Play Store resta soggetta a review.";

export const RELEASE_STORE = "fenix-release-jobs";
export const LEASE_MS = 45_000;
