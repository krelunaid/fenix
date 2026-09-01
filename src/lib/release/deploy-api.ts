import { appleJwt, googleAccessToken, releaseFetch } from "./store-api.ts";

export type DeployCheck = { ok: true; id?: string; state?: string } | { ok: false; error: string };

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export async function netlifyFindOrCreateSite(
  token: string,
  name: string,
  existingId?: string,
): Promise<DeployCheck> {
  if (existingId) {
    const got = await releaseFetch(`https://api.netlify.com/api/v1/sites/${existingId}`, {
      headers: auth(token),
    });
    if (got.ok) return { ok: true, id: existingId };
  }
  let list: Response;
  try {
    list = await releaseFetch("https://api.netlify.com/api/v1/sites?per_page=100", {
      headers: auth(token),
    });
  } catch {
    return { ok: false, error: "Netlify non risponde. Riprova: non creo un secondo sito." };
  }
  if (list.status === 401 || list.status === 403) {
    return {
      ok: false,
      error: "Netlify ha rifiutato il token. Controlla il ruolo Owner/Developer sul server.",
    };
  }
  if (list.ok) {
    const sites = (await list.json().catch(() => [])) as { id?: string; name?: string }[];
    const match = Array.isArray(sites) ? sites.find((s) => s.name === name) : undefined;
    if (match?.id) return { ok: true, id: match.id };
  }
  let created: Response;
  try {
    created = await releaseFetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    return { ok: false, error: "Netlify non risponde in creazione sito. Riprova." };
  }
  if (!created.ok) {
    return {
      ok: false,
      error: "Netlify non ha creato il sito. Serve ruolo Owner o Developer.",
    };
  }
  const body = (await created.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return { ok: false, error: "Netlify ha creato un sito senza id." };
  return { ok: true, id: body.id };
}

export async function netlifyCreateDeploy(
  token: string,
  siteId: string,
  zip: Uint8Array,
  title: string,
  existingId?: string,
): Promise<DeployCheck> {
  if (existingId) {
    const got = await netlifyGetDeploy(token, existingId);
    if (got.ok && (got.state === "ready" || got.state === "current" || got.state === "processing")) {
      return got;
    }
  }
  let res: Response;
  try {
    res = await releaseFetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys?title=${encodeURIComponent(title)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
      body: Buffer.from(zip),
    });
  } catch {
    return { ok: false, error: "Netlify non risponde sul deploy. Riprova: non carico un secondo zip." };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "Netlify ha rifiutato il token sul deploy. Ruolo Owner o Developer.",
    };
  }
  if (!res.ok) {
    return { ok: false, error: `Netlify deploy ${res.status}. Riprova senza duplicare.` };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string; state?: string };
  if (!body.id) return { ok: false, error: "Netlify ha avviato un deploy senza id." };
  return { ok: true, id: body.id, state: body.state };
}

export async function netlifyGetDeploy(token: string, deployId: string): Promise<DeployCheck> {
  let res: Response;
  try {
    res = await releaseFetch(`https://api.netlify.com/api/v1/deploys/${deployId}`, {
      headers: auth(token),
    });
  } catch {
    return { ok: false, error: "Netlify non risponde sullo stato del deploy." };
  }
  if (!res.ok) return { ok: false, error: `Netlify deploy ${res.status}.` };
  const body = (await res.json().catch(() => ({}))) as { id?: string; state?: string };
  return { ok: true, id: body.id || deployId, state: body.state };
}

export async function appleListLatestBuild(
  creds: { issuerId: string; keyId: string; privateKey: string },
  appId: string,
): Promise<DeployCheck> {
  let token: string;
  try {
    token = await appleJwt(creds);
  } catch {
    return { ok: false, error: "Chiave API Apple non valida sul poll TestFlight." };
  }
  const url =
    "https://api.appstoreconnect.apple.com/v1/builds?limit=1&filter[app]=" + encodeURIComponent(appId);
  let res: Response;
  try {
    res = await releaseFetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    return { ok: false, error: "App Store Connect non risponde sul processing." };
  }
  if (!res.ok) {
    return { ok: false, error: `App Store Connect processing ${res.status}.` };
  }
  const body = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; attributes?: { processingState?: string } }[];
  };
  const row = body.data?.[0];
  const state = row?.attributes?.processingState;
  return { ok: true, id: row?.id, state };
}

export async function playInsertEdit(
  rawJson: string,
  packageName: string,
  existingId?: string,
): Promise<DeployCheck> {
  if (existingId) return { ok: true, id: existingId };
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return { ok: false, error: token.error };
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits";
  let res: Response;
  try {
    res = await releaseFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    return { ok: false, error: "Play Console non risponde sull'edit. Riprova." };
  }
  if (!res.ok) return { ok: false, error: "Play Console non ha aperto l'edit. Ruolo Release Manager." };
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return { ok: false, error: "Play Console ha aperto un edit senza id." };
  return { ok: true, id: body.id };
}

export async function playUploadBundle(
  rawJson: string,
  packageName: string,
  editId: string,
  aab: Uint8Array,
  existingVersion?: string,
): Promise<DeployCheck> {
  if (existingVersion) return { ok: true, id: existingVersion };
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return { ok: false, error: token.error };
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits/" +
    encodeURIComponent(editId) +
    "/bundles?uploadType=media";
  let res: Response;
  try {
    res = await releaseFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(aab),
    });
  } catch {
    return { ok: false, error: "Play Console non risponde sull'upload AAB. Non carico un secondo file." };
  }
  if (!res.ok) return { ok: false, error: "Play Console ha rifiutato l'AAB. Ruolo Release Manager." };
  const body = (await res.json().catch(() => ({}))) as { versionCode?: number | string };
  const code = body.versionCode != null ? String(body.versionCode) : "1";
  return { ok: true, id: code };
}

export async function playCommitInternal(
  rawJson: string,
  packageName: string,
  editId: string,
  versionCode: string,
): Promise<DeployCheck> {
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return { ok: false, error: token.error };
  const trackUrl =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits/" +
    encodeURIComponent(editId) +
    "/tracks/internal";
  const track = await releaseFetch(trackUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      track: "internal",
      releases: [{ status: "completed", versionCodes: [versionCode] }],
    }),
  });
  if (!track.ok) return { ok: false, error: "Play Console non ha aggiornato il canale internal." };
  const commitUrl =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits/" +
    encodeURIComponent(editId) +
    ":commit";
  const commit = await releaseFetch(commitUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!commit.ok) return { ok: false, error: "Play Console non ha chiuso l'edit internal." };
  return { ok: true, id: editId, state: "completed" };
}

export async function playGetInternalTrack(
  rawJson: string,
  packageName: string,
): Promise<DeployCheck> {
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return { ok: false, error: token.error };
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/tracks/internal";
  let res: Response;
  try {
    res = await releaseFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, error: "Play Console non risponde sul canale internal." };
  }
  if (res.status === 404) return { ok: true, state: "pending" };
  if (!res.ok) return { ok: false, error: `Play internal ${res.status}.` };
  const body = (await res.json().catch(() => ({}))) as {
    releases?: { status?: string }[];
  };
  const status = body.releases?.[0]?.status || "completed";
  return { ok: true, state: status };
}
