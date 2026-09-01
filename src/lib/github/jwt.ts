/**
 * GitHub App JWT. RS256, iat skew -60s, exp ≤ 10 minutes.
 * https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { githubAppConfig, type GitHubAppConfig } from "./secrets.server.ts";

export async function githubAppJwt(config?: GitHubAppConfig | null): Promise<string> {
  const cfg = config || githubAppConfig();
  if (!cfg) throw new Error("GitHub non configurato.");
  const key = createPrivateKey(cfg.privateKey);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(cfg.appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 8 * 60)
    .sign(key);
}
