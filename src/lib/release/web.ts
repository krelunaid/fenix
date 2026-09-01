import { writePublished } from "../projects/published-store.ts";
import { zipFiles } from "../projects/zip.ts";
import { netlifyCreateDeploy, netlifyFindOrCreateSite, netlifyGetDeploy } from "./deploy-api.ts";
import { netlifyToken } from "./secrets.server.ts";
import type { AdapterResult, PersistTrack, StoredReleaseJob, TrackState } from "./types.ts";

export type WebOwner = { ownerId: string };

function siteSlug(job: StoredReleaseJob): string {
  const raw = (job.config.siteName || job.name || "fenix")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `fenix-${raw || "app"}`;
}

export async function runWebStep(
  step: TrackState["step"],
  job: StoredReleaseJob,
  track: TrackState,
  persist: PersistTrack,
  access: WebOwner,
): Promise<AdapterResult> {
  const token = netlifyToken();
  const fixture = !token;

  if (step === "preflight") return { ok: true, step, fixture };
  if (step === "build" || step === "sign") {
    return { ok: true, step, fixture, artifact: "index.html" };
  }

  if (step === "upload") {
    if (track.provider?.deployId) {
      return {
        ok: true,
        step,
        fixture,
        artifact: track.artifact || `/sito/${job.projectId}`,
        reconciled: true,
      };
    }
    const saved = await writePublished(
      job.projectId,
      {
        name: job.name,
        tagline: job.tagline,
        kind: job.kind,
        summary: job.summary,
        palette: job.palette,
        html: job.html,
      },
      { ownerId: access.ownerId },
    );
    if ("error" in saved) return { ok: false, step, fixture: false, error: saved.error };
    const fenixUrl = `/sito/${saved.id}`;
    if (!token) {
      if (track.provider?.uploadId) {
        return { ok: true, step, fixture: true, artifact: fenixUrl, reconciled: true };
      }
      await persist({ provider: { ...track.provider, uploadId: `fenix:${saved.id}` } });
      return { ok: true, step, fixture: true, artifact: fenixUrl };
    }
    const name = siteSlug(job);
    const site = await netlifyFindOrCreateSite(token, name, track.provider?.siteId);
    if (!site.ok) return { ok: false, step, fixture: false, error: site.error };
    if (!site.id) return { ok: false, step, fixture: false, error: "Netlify ha creato un sito senza id." };
    await persist({ provider: { ...track.provider, siteId: site.id } });
    const zip = zipFiles([{ path: "index.html", content: job.html }]);
    const title = track.provider?.intentId || `${job.id}:${job.htmlHash}`;
    await persist({ provider: { ...track.provider, siteId: site.id, intentId: title } });
    const deploy = await netlifyCreateDeploy(token, site.id, zip, title, track.provider?.deployId);
    if (!deploy.ok) return { ok: false, step, fixture: false, error: deploy.error };
    if (!deploy.id) return { ok: false, step, fixture: false, error: "Netlify ha avviato un deploy senza id." };
    await persist({
      provider: { ...track.provider, siteId: site.id, deployId: deploy.id, intentId: title },
    });
    return { ok: true, step, fixture: false, artifact: fenixUrl };
  }

  if (step === "processing") {
    const tokenNow = netlifyToken();
    if (!tokenNow || !track.provider?.deployId) return { ok: true, step, fixture: !tokenNow };
    const got = await netlifyGetDeploy(tokenNow, track.provider.deployId);
    if (!got.ok) return { ok: false, step, fixture: false, error: got.error };
    const state = (got.state || "").toLowerCase();
    if (state === "uploaded" || state === "uploading" || state === "processing" || state === "prepared") {
      return { ok: true, step, fixture: false, pending: true, artifact: got.id };
    }
    if (state === "error" || state === "failed") {
      return {
        ok: false,
        step,
        fixture: false,
        error: "Netlify ha rifiutato il deploy. Riprendi: non duplico lo zip.",
      };
    }
    return { ok: true, step, fixture: false, artifact: `/sito/${job.projectId}` };
  }

  if (step === "ready") {
    return {
      ok: true,
      step: "ready",
      fixture: !netlifyToken(),
      artifact: `/sito/${job.projectId}`,
    };
  }

  return { ok: true, step, fixture: !token };
}
