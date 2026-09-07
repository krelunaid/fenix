import { LocalSandbox } from "./local.mjs";
import { DockerSandbox } from "./docker.mjs";

/**
 * Pick the sandbox backend. `AGENT_SANDBOX=docker` in production; `local` for
 * development and tests. Local is not an isolation boundary.
 */
export async function createSandbox({ backend = process.env.AGENT_SANDBOX || "local", ...options } = {}) {
  if (backend === "docker") return DockerSandbox.create(options);
  if (backend === "local") return LocalSandbox.create(options);
  throw new Error(`Sandbox sconosciuto: ${backend}`);
}

export { LocalSandbox, DockerSandbox };
