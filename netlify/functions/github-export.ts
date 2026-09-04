import { handleGitHubExport } from "../../src/lib/github/http.ts";

export default async (req: Request) => handleGitHubExport(req);

export const config = {
  path: "/api/github/export",
};
