import { handleGitHubCallback } from "../../src/lib/github/http.ts";

export default async (req: Request) => handleGitHubCallback(req);

export const config = {
  path: "/api/github/callback",
};
