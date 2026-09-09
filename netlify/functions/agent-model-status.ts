import { getStore } from "@netlify/blobs";
import { AGENT_MODEL_RELAY_STORE, handleAgentModelStatus } from "../../src/lib/agent/model-relay.ts";

const env = (name: string) => {
  const runtime = (globalThis as typeof globalThis & { Netlify?: { env?: { get?: (key: string) => string | undefined } } }).Netlify;
  return runtime?.env?.get?.(name) ?? process.env[name];
};

export default async (req: Request, context: { params?: { id?: string } }) => {
  const store = getStore({ name: AGENT_MODEL_RELAY_STORE, consistency: "strong" });
  return handleAgentModelStatus(req, String(context.params?.id || ""), { store, env });
};

export const config = {
  path: "/api/agent-model/:id",
};
