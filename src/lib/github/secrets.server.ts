/**
 * GitHub App host credentials. Import only from server handlers.
 * Values never leave this module except as booleans / parsed config.
 *
 * Official: App ID or Client ID + PEM private key, JWT RS256, installation access tokens.
 * https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */

export type GitHubAppConfig = {
  appId: string;
  privateKey: string;
  slug: string;
  /** OAuth client of the same App: needed to prove the connecting user owns the installation. */
  clientId?: string;
  clientSecret?: string;
};

let testConfig: GitHubAppConfig | null = null;

export function setGitHubAppForTest(config: GitHubAppConfig | null) {
  testConfig = config;
}

function pemFrom(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

function looksLikeAppPem(raw: string): boolean {
  const dash = "-----";
  return (
    raw.includes(`${dash}BEGIN RSA PRIVATE KEY${dash}`) ||
    raw.includes(`${dash}BEGIN PRIVATE KEY${dash}`)
  );
}

export function githubAppConfig(): GitHubAppConfig | null {
  const raw = testConfig || readEnvConfig();
  if (!raw) return null;
  if (!raw.appId || !raw.slug || raw.privateKey.length < 32) return null;
  if (!looksLikeAppPem(raw.privateKey)) return null;
  return raw;
}

function readEnvConfig(): GitHubAppConfig | null {
  const appId = (process.env.GITHUB_APP_ID || process.env.GITHUB_APP_CLIENT_ID || "").trim();
  const privateKey = pemFrom(process.env.GITHUB_APP_PRIVATE_KEY || "");
  const slug = (process.env.GITHUB_APP_SLUG || "").trim();
  if (!appId || !slug || privateKey.length < 32) return null;
  const clientId = (process.env.GITHUB_APP_CLIENT_ID || "").trim() || undefined;
  const clientSecret = (process.env.GITHUB_APP_CLIENT_SECRET || "").trim() || undefined;
  return { appId, privateKey, slug, clientId, clientSecret };
}

/**
 * True when the callback can verify the user↔installation link (OAuth code
 * exchange). Without it the connect flow is refused: accepting any
 * `installation_id` would let a visitor attach someone else's installation.
 */
export function githubUserAuthConfigured(): boolean {
  const cfg = githubAppConfig();
  return Boolean(cfg?.clientId && cfg?.clientSecret && cfg.clientSecret.length >= 16);
}

export function githubConfigured(): boolean {
  return Boolean(githubAppConfig());
}
