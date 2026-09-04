import { handleGitHubRepos } from "../../src/lib/github/http.ts";

export default async (req: Request) => handleGitHubRepos(req);

export const config = {
  path: "/api/github/repos",
};
