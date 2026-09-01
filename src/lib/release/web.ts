import { writePublished } from "../projects/published-store.ts";
import { zipFiles } from "../projects/zip.ts";
import {
  netlifyCreateDeploy,
  netlifyFindOrCreateSite,
  netlifyGetDeploy,
  netlifyListDeploys,
} from "./deploy-api.ts";
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

function liveUrl(track: TrackState, job: StoredReleaseJob, fallback?: string): string {
  return (
    track.provider?.liveUrl ||
    fallback ||
    `/sito/${job.projectId}`
  );
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
    if (track.provider?.deployId || track.provider?.uploadId) {
      return {
        ok: true,
        step,
        fixture,
        artifact: liveUrl(track, job, track.artifact),
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
      if (track.provider?.inflight === "fenix") {
        await persist({ provider: { ...track.provider, uploadId: `fenix:${saved.id}`, inflight: undefined } });
        return { ok: true, step, fixture: true, artifact: fenixUrl, reconciled: true };
      }
      await persist({ provider: { ...track.provider, inflight: "fenix" } });
      await persist({ provider: { ...track.provider, uploadId: `fenix:${saved.id}`, inflight: undefined } });
      return { ok: true, step, fixture: true, artifact: fenixUrl };
    }
    const name = siteSlug(job);
    const site = await netlifyFindOrCreateSite(token, name, track.provider?.siteId);
    if (!site.ok) return { ok: false, step, fixture: false, error: site.error };
    if (!site.id) return { ok: false, step, fixture: false, error: "Netlify ha creato un sito senza id." };
    const title = track.provider?.intentId || `${job.id}:${job.htmlHash}`;
    await persist({
      provider: {
        ...track.provider,
        siteId: site.id,
        intentId: title,
        liveUrl: site.url || track.provider?.liveUrl,
      },
    });
    const listed = await netlifyListDeploys(token, site.id, title);
    if (listed.ok && listed.id) {
      const url = listed.url || site.url || track.provider?.liveUrl;
      await persist({
        provider: {
          ...track.provider,
          siteId: site.id,
          deployId: listed.id,
          intentId: title,
          inflight: undefined,
          liveUrl: url,
        },
      });
      return { ok: true, step, fixture: false, artifact: url || fenixUrl, reconciled: true };
    }
    await persist({
      provider: { ...track.provider, siteId: site.id, intentId: title, inflight: "deploy", liveUrl: site.url },
    });
    const zip = zipFiles([{ path: "index.html", content: job.html }]);
    const deploy = await netlifyCreateDeploy(token, site.id, zip, title, track.provider?.deployId);
    if (!deploy.ok) return { ok: false, step, fixture: false, error: deploy.error };
    if (!deploy.id) return { ok: false, step, fixture: false, error: "Netlify ha avviato un deploy senza id." };
    const url = deploy.url || site.url;
    await persist({
      provider: {
        ...track.provider,
        siteId: site.id,
        deployId: deploy.id,
        intentId: title,
        inflight: undefined,
        liveUrl: url,
      },
    });
    return { ok: true, step, fixture: false, artifact: url || fenixUrl };
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
    const url = got.url || track.provider.liveUrl;
    if (url) await persist({ provider: { ...track.provider, liveUrl: url } });
    return { ok: true, step, fixture: false, artifact: url || `/sito/${job.projectId}` };
  }

  if (step === "ready") {
    return {
      ok: true,
      step: "ready",
      fixture: !netlifyToken(),
      artifact: liveUrl(track, job),
    };
  }

  return { ok: true, step, fixture: !token };
}
