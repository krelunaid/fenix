import { getStore } from "@netlify/blobs";
import { AGENT_MODEL_RELAY_STORE, handleAgentModelBackground } from "../../src/lib/agent/model-relay.ts";

const env = (name: string) => {
  const runtime = (globalThis as typeof globalThis & { Netlify?: { env?: { get?: (key: string) => string | undefined } } }).Netlify;
  return runtime?.env?.get?.(name) ?? process.env[name];
};

export default async (req: Request) => {
  const store = getStore({ name: AGENT_MODEL_RELAY_STORE, consistency: "strong" });
  return handleAgentModelBackground(req, { store, env });
};

export const config = {
  path: "/api/agent-model",
};
