import { appleJwt, googleAccessToken, releaseFetch } from "./store-api.ts";

export { setReleaseFetchForTest } from "./store-api.ts";

export type DeployCheck = {
  ok: true;
  id?: string;
  state?: string;
  url?: string;
} | { ok: false; error: string };

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function asUrl(body: { ssl_url?: string; url?: string; deploy_ssl_url?: string }): string | undefined {
  return body.ssl_url || body.deploy_ssl_url || body.url || undefined;
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
    if (got.ok) {
      const body = (await got.json().catch(() => ({}))) as { id?: string; ssl_url?: string; url?: string };
      return { ok: true, id: existingId, url: asUrl(body) };
    }
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
    const sites = (await list.json().catch(() => [])) as {
      id?: string;
      name?: string;
      ssl_url?: string;
      url?: string;
    }[];
    const match = Array.isArray(sites) ? sites.find((s) => s.name === name) : undefined;
    if (match?.id) return { ok: true, id: match.id, url: asUrl(match) };
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
  const body = (await created.json().catch(() => ({}))) as { id?: string; ssl_url?: string; url?: string };
  if (!body.id) return { ok: false, error: "Netlify ha creato un sito senza id." };
  return { ok: true, id: body.id, url: asUrl(body) };
}

export async function netlifyListDeploys(
  token: string,
  siteId: string,
  title?: string,
): Promise<DeployCheck> {
  let res: Response;
  try {
    res = await releaseFetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=30`, {
      headers: auth(token),
    });
  } catch {
    return { ok: false, error: "Netlify non risponde sull'elenco deploy." };
  }
  if (!res.ok) return { ok: true };
  const body = (await res.json().catch(() => [])) as {
    id?: string;
    state?: string;
    title?: string;
    ssl_url?: string;
    url?: string;
  }[];
  const rows = Array.isArray(body) ? body : [];
  const match = title ? rows.find((d) => d.title === title && d.id) : undefined;
  if (match?.id) return { ok: true, id: match.id, state: match.state, url: asUrl(match) };
  return { ok: true };
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
  const listed = await netlifyListDeploys(token, siteId, title);
  if (listed.ok && listed.id) return listed;
  let res: Response;
  try {
    res = await releaseFetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys?title=${encodeURIComponent(title)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
        body: Buffer.from(zip),
      },
    );
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
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    state?: string;
    ssl_url?: string;
    url?: string;
  };
  if (!body.id) return { ok: false, error: "Netlify ha avviato un deploy senza id." };
  return { ok: true, id: body.id, state: body.state, url: asUrl(body) };
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
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    state?: string;
    ssl_url?: string;
    url?: string;
  };
  return { ok: true, id: body.id || deployId, state: body.state, url: asUrl(body) };
}

export async function appleListLatestBuild(
  creds: { issuerId: string; keyId: string; privateKey: string },
  appId: string,
  identity?: { versionName?: string; build?: string },
): Promise<DeployCheck> {
  let token: string;
  try {
    token = await appleJwt(creds);
  } catch {
    return { ok: false, error: "Chiave API Apple non valida sul poll TestFlight." };
  }
  const params = new URLSearchParams();
  params.set("filter[app]", appId);
  params.set("limit", "20");
  if (identity?.build) params.set("filter[version]", identity.build);
  if (identity?.versionName) params.set("filter[preReleaseVersion.version]", identity.versionName);
  const url = "https://api.appstoreconnect.apple.com/v1/builds?" + params.toString();
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
    data?: { id?: string; attributes?: { processingState?: string; version?: string } }[];
  };
  const rows = Array.isArray(body.data) ? body.data : [];
  const match = identity?.build
    ? rows.find((r) => String(r.attributes?.version || "") === String(identity.build))
    : undefined;
  if (!match) return { ok: true };
  return { ok: true, id: match.id, state: match.attributes?.processingState };
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

export async function playDeleteEdit(rawJson: string, packageName: string, editId: string): Promise<void> {
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return;
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits/" +
    encodeURIComponent(editId);
  try {
    await releaseFetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* let the edit expire */
  }
}

async function playListBundles(
  token: string,
  packageName: string,
  editId: string,
  expectedVersion?: string,
): Promise<DeployCheck> {
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits/" +
    encodeURIComponent(editId) +
    "/bundles";
  let res: Response;
  try {
    res = await releaseFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: true };
  }
  if (!res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as {
    bundles?: { versionCode?: number | string }[];
  };
  const bundles = Array.isArray(body.bundles) ? body.bundles : [];
  if (expectedVersion) {
    const hit = bundles.find((b) => String(b.versionCode) === String(expectedVersion));
    if (hit?.versionCode != null) return { ok: true, id: String(hit.versionCode) };
  }
  return { ok: true };
}

export async function playUploadBundle(
  rawJson: string,
  packageName: string,
  editId: string,
  aab: Uint8Array,
  expectedVersion?: string,
): Promise<DeployCheck> {
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return { ok: false, error: token.error };
  const listed = await playListBundles(token, packageName, editId, expectedVersion);
  if (listed.ok && listed.id) return listed;
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
  const code = body.versionCode != null ? String(body.versionCode) : undefined;
  if (!code) return { ok: false, error: "Play Console ha caricato un AAB senza versionCode." };
  return { ok: true, id: code };
}

function trackHasVersion(
  body: { releases?: { status?: string; versionCodes?: (string | number)[] }[] },
  versionCode: string,
): { found: boolean; status?: string } {
  const releases = Array.isArray(body.releases) ? body.releases : [];
  for (const rel of releases) {
    const codes = (rel.versionCodes || []).map((c) => String(c));
    if (codes.includes(String(versionCode))) return { found: true, status: rel.status };
  }
  return { found: false };
}

export async function playGetInternalTrack(
  rawJson: string,
  packageName: string,
  versionCode?: string,
): Promise<DeployCheck> {
  const token = await googleAccessToken(rawJson);
  if (typeof token !== "string") return { ok: false, error: token.error };
  const edit = await playInsertEdit(rawJson, packageName);
  if (!edit.ok) return edit;
  if (!edit.id) return { ok: false, error: "Play Console ha aperto un edit senza id." };
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/edits/" +
    encodeURIComponent(edit.id) +
    "/tracks/internal";
  let res: Response;
  try {
    res = await releaseFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    await playDeleteEdit(rawJson, packageName, edit.id);
    return { ok: false, error: "Play Console non risponde sul canale internal." };
  }
  const body = (await res.json().catch(() => ({}))) as {
    releases?: { status?: string; versionCodes?: (string | number)[] }[];
  };
  await playDeleteEdit(rawJson, packageName, edit.id);
  if (res.status === 404) return { ok: true, state: "pending" };
  if (!res.ok) return { ok: false, error: `Play internal ${res.status}.` };
  if (versionCode) {
    const hit = trackHasVersion(body, versionCode);
    if (!hit.found) return { ok: true, state: "pending" };
    return { ok: true, state: hit.status || "completed", id: versionCode };
  }
  const status = body.releases?.[0]?.status || "pending";
  return { ok: true, state: status };
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
  if (!track.ok) {
    const verified = await playGetInternalTrack(rawJson, packageName, versionCode);
    if (verified.ok && verified.state === "completed") return verified;
    return {
      ok: false,
      error: "Play Console non ha aggiornato il canale internal con questo versionCode.",
    };
  }
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
  if (!commit.ok) {
    const verified = await playGetInternalTrack(rawJson, packageName, versionCode);
    if (verified.ok && verified.state === "completed") return verified;
    return { ok: false, error: "Play Console non ha chiuso l'edit internal con questo versionCode." };
  }
  return { ok: true, id: editId, state: "completed" };
}
