/**
 * Host credentials. Import only from server handlers / engine / adapters.
 * Values never leave this module except as booleans and redacted presence.
 */
function present(name: string): boolean {
  const v = process.env[name]?.trim();
  return Boolean(v && v.length > 8);
}

export function releaseFixtureAllowed(): boolean {
  if (process.env.FENIX_RELEASE_FIXTURE === "1") return true;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) return false;
  return true;
}

export function netlifyConnected(): boolean {
  return present("NETLIFY_AUTH_TOKEN") || present("NETLIFY_RELEASE_TOKEN");
}

export function appleConnected(): boolean {
  return present("APPLE_ISSUER_ID") && present("APPLE_KEY_ID") && present("APPLE_PRIVATE_KEY");
}

export function googleConnected(): boolean {
  return present("GOOGLE_PLAY_SERVICE_ACCOUNT") || present("GOOGLE_PLAY_JSON");
}

export function netlifyToken(): string | null {
  const t = process.env.NETLIFY_AUTH_TOKEN?.trim() || process.env.NETLIFY_RELEASE_TOKEN?.trim();
  return t && t.length > 8 ? t : null;
}

export function appleCredentials(): { issuerId: string; keyId: string; privateKey: string } | null {
  const issuerId = process.env.APPLE_ISSUER_ID?.trim() || "";
  const keyId = process.env.APPLE_KEY_ID?.trim() || "";
  const privateKey = process.env.APPLE_PRIVATE_KEY?.trim() || "";
  if (!issuerId || !keyId || !privateKey) return null;
  return { issuerId, keyId, privateKey };
}

export function googleServiceAccount(): string | null {
  const raw =
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT?.trim() || process.env.GOOGLE_PLAY_JSON?.trim() || "";
  return raw.length > 8 ? raw : null;
}
