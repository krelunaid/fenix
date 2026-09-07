import { handleAgentRequest } from "../../src/lib/agent/http.ts";

/** Trusted proxy in front of the agent worker: token server-side, credits on the server. */
export default async (req: Request) => {
  const rest = new URL(req.url).pathname.replace(/^\/api\/agent/, "") || "/";
  return handleAgentRequest(req, rest);
};

export const config = {
  path: "/api/agent/*",
};
