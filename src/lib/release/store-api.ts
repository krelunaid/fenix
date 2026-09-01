import { importPKCS8, SignJWT } from "jose";

export type StoreCheck = { ok: true } | { ok: false; error: string };

type ReleaseFetch = typeof fetch;

let customFetch: ReleaseFetch | null = null;

export function setReleaseFetchForTest(fn: ReleaseFetch | null) {
  customFetch = fn;
}

function callFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return (customFetch || fetch)(input, init);
}

function pemFrom(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

export async function applePreflight(
  creds: { issuerId: string; keyId: string; privateKey: string },
  bundleId: string,
): Promise<StoreCheck> {
  let token: string;
  try {
    const key = await importPKCS8(pemFrom(creds.privateKey), "ES256");
    token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: creds.keyId, typ: "JWT" })
      .setIssuer(creds.issuerId)
      .setIssuedAt()
      .setExpirationTime("15m")
      .setAudience("appstoreconnect-v1")
      .sign(key);
  } catch {
    return {
      ok: false,
      error:
        "Chiave API Apple non valida. Sul server servono Issuer ID, Key ID e .p8 con ruolo App Manager o Admin.",
    };
  }
  const url =
    "https://api.appstoreconnect.apple.com/v1/apps?limit=1&filter[bundleId]=" +
    encodeURIComponent(bundleId);
  let res: Response;
  try {
    res = await callFetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    return {
      ok: false,
      error: "App Store Connect non risponde. Riprova: non carico un secondo pacchetto.",
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error:
        "App Store Connect ha rifiutato la chiave. Serve ruolo App Manager o Admin sulla API key.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: `App Store Connect ha risposto ${res.status}. Controlla il record e i ruoli, poi riprova.`,
    };
  }
  let body: { data?: unknown[] };
  try {
    body = (await res.json()) as { data?: unknown[] };
  } catch {
    return { ok: false, error: "App Store Connect ha risposto un JSON non valido." };
  }
  if (!Array.isArray(body.data) || body.data.length === 0) {
    return {
      ok: false,
      error: `Manca il record App Store Connect per ${bundleId}. Crea l'app (ruolo App Manager o Admin) e riprova.`,
    };
  }
  return { ok: true };
}

type GoogleAccount = { client_email: string; private_key: string };

export function parseGoogleServiceAccount(raw: string): GoogleAccount | { error: string } {
  const text = String(raw || "").trim();
  if (!text) return { error: "Manca il JSON del service account Play." };
  const candidates = [text];
  if (!text.startsWith("{")) {
    try {
      candidates.push(Buffer.from(text, "base64").toString("utf8"));
    } catch {
      /* not base64 */
    }
  }
  for (const candidate of candidates) {
    try {
      const json = JSON.parse(candidate) as { client_email?: unknown; private_key?: unknown };
      const email = typeof json.client_email === "string" ? json.client_email.trim() : "";
      const key = typeof json.private_key === "string" ? pemFrom(json.private_key) : "";
      if (email && key.includes("BEGIN")) return { client_email: email, private_key: key };
    } catch {
      /* next */
    }
  }
  return {
    error:
      "JSON del service account Play non valido. Incollalo sul server (ruolo Release Manager), mai nel browser.",
  };
}

export async function googlePreflight(rawJson: string, packageName: string): Promise<StoreCheck> {
  const account = parseGoogleServiceAccount(rawJson);
  if ("error" in account) return { ok: false, error: account.error };
  let assertion: string;
  try {
    const key = await importPKCS8(account.private_key, "RS256");
    assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(account.client_email)
      .setIssuedAt()
      .setExpirationTime("1h")
      .setAudience("https://oauth2.googleapis.com/token")
      .sign(key);
  } catch {
    return {
      ok: false,
      error:
        "Chiave del service account Play non valida. Controlla il JSON sul server (ruolo Release Manager).",
    };
  }
  let tokenRes: Response;
  try {
    tokenRes = await callFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch {
    return { ok: false, error: "Google non risponde per il token. Riprova: non carico un secondo AAB." };
  }
  if (!tokenRes.ok) {
    return {
      ok: false,
      error: "Play Console ha rifiutato il service account. Serve ruolo Release Manager.",
    };
  }
  let tokenBody: { access_token?: string };
  try {
    tokenBody = (await tokenRes.json()) as { access_token?: string };
  } catch {
    return { ok: false, error: "Google ha risposto un token non valido." };
  }
  if (!tokenBody.access_token) {
    return { ok: false, error: "Play Console ha rifiutato il service account. Serve ruolo Release Manager." };
  }
  const appUrl =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName);
  let appRes: Response;
  try {
    appRes = await callFetch(appUrl, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
  } catch {
    return { ok: false, error: "Play Console non risponde. Riprova: non carico un secondo AAB." };
  }
  if (appRes.status === 401 || appRes.status === 403) {
    return {
      ok: false,
      error: "Play Console ha rifiutato il service account. Serve ruolo Release Manager.",
    };
  }
  if (appRes.status === 404) {
    return {
      ok: false,
      error: `Manca l'app in Play Console per ${packageName}. Crea il record (ruolo Release Manager) e riprova.`,
    };
  }
  if (!appRes.ok) {
    return {
      ok: false,
      error: `Play Console ha risposto ${appRes.status}. Controlla il record e i ruoli, poi riprova.`,
    };
  }
  return { ok: true };
}
