import { handleGitHubCollection } from "../../src/lib/github/http.ts";

export default async (req: Request) => handleGitHubCollection(req);

export const config = {
  path: "/api/github",
};
