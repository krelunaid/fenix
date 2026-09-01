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
};

let testConfig: GitHubAppConfig | null = null;

export function setGitHubAppForTest(config: GitHubAppConfig | null) {
  testConfig = config;
}

function pemFrom(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

const PEM_RE = /-----BEGIN (?:RSA )?PRIVATE KEY-----|-----BEGIN PRIVATE KEY-----/;

export function githubAppConfig(): GitHubAppConfig | null {
  const raw = testConfig || readEnvConfig();
  if (!raw) return null;
  if (!raw.appId || !raw.slug || raw.privateKey.length < 32) return null;
  if (!PEM_RE.test(raw.privateKey)) return null;
  return raw;
}

function readEnvConfig(): GitHubAppConfig | null {
  const appId = (process.env.GITHUB_APP_ID || process.env.GITHUB_APP_CLIENT_ID || "").trim();
  const privateKey = pemFrom(process.env.GITHUB_APP_PRIVATE_KEY || "");
  const slug = (process.env.GITHUB_APP_SLUG || "").trim();
  if (!appId || !slug || privateKey.length < 32) return null;
  return { appId, privateKey, slug };
}

export function githubConfigured(): boolean {
  return Boolean(githubAppConfig());
}
