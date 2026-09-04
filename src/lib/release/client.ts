import { OWNER_HEADER } from "../projects/publish-owner.ts";
import { getOwnerCapability } from "../projects/publish-client.ts";
import type { Palette, ProjectKind } from "../projects/types.ts";
import type { Platform, PublicReleaseJob, ReleaseAccounts } from "./types.ts";

export type { Platform, PublicReleaseJob, ReleaseAccounts } from "./types.ts";
export { REVIEW_NOTE, PLATFORMS } from "./types.ts";
export { suggestedBundleId, suggestedPackageName } from "./ids.ts";

async function asJson<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || "Rilascio rifiutato.");
  }
  return payload;
}

export async function loadReleaseAccounts(): Promise<ReleaseAccounts> {
  const res = await fetch("/api/release", { cache: "no-store" });
  return asJson<ReleaseAccounts>(res);
}

export async function startRelease(input: {
  projectId: string;
  name: string;
  tagline?: string;
  kind: ProjectKind;
  summary?: string;
  palette: Palette;
  html: string;
  platforms: Platform[];
  bundleId?: string;
  packageName?: string;
  siteName?: string;
}): Promise<PublicReleaseJob> {
  const owner = getOwnerCapability();
  const res = await fetch("/api/release", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [OWNER_HEADER]: owner,
      "x-fenix-idempotency": input.projectId + ":" + input.platforms.slice().sort().join(","),
    },
    cache: "no-store",
    body: JSON.stringify({
      projectId: input.projectId,
      name: input.name,
      tagline: input.tagline ?? "",
      kind: input.kind,
      summary: input.summary ?? "",
      palette: input.palette,
      html: input.html,
      platforms: input.platforms,
      bundleId: input.bundleId,
      packageName: input.packageName,
      siteName: input.siteName,
    }),
  });
  return asJson<PublicReleaseJob>(res);
}

export async function loadReleaseJob(id: string): Promise<PublicReleaseJob> {
  const owner = getOwnerCapability();
  const res = await fetch(`/api/release/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: { [OWNER_HEADER]: owner },
  });
  return asJson<PublicReleaseJob>(res);
}

export async function resumeReleaseJob(id: string): Promise<PublicReleaseJob> {
  const owner = getOwnerCapability();
  const res = await fetch(`/api/release/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { [OWNER_HEADER]: owner },
    cache: "no-store",
  });
  return asJson<PublicReleaseJob>(res);
}
