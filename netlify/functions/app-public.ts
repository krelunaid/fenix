import { handlePublicAppRequest } from "../../src/lib/agent/http.ts";

/** Public address of apps published from the Agente: https://fenix.kreluna.it/app/<slug>/… */
export default async (req: Request) => {
  const m = new URL(req.url).pathname.match(/^\/app\/([^/]+)(\/.*)?$/);
  if (!m) return Response.json({ error: "Indirizzo non valido." }, { status: 404 });
  if (m[2] == null) return Response.redirect(new URL(`/app/${m[1]}/`, req.url).toString(), 301);
  return handlePublicAppRequest(req, m[1], m[2]);
};

export const config = {
  path: "/app/*",
};
