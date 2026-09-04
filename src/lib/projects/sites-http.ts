import { ownerFromRequest } from "./publish-owner.ts";
import { publicSnapshot, readPublished, writePublished } from "./published-store.ts";
import type { PublishInput } from "./published.ts";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Shared GET/PUT for TanStack and the Netlify function. Identical auth. */
export async function handleSiteRequest(request: Request, id: string): Promise<Response> {
  if (request.method === "GET") {
    const snap = await readPublished(id);
    if (!snap) {
      if (new URL(request.url).searchParams.get("optional") === "1") {
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      }
      return json({ error: "Sito non trovato" }, 404);
    }
    return json(publicSnapshot(snap));
  }
  if (request.method === "PUT") {
    const ownerId = ownerFromRequest(request);
    if (!ownerId) return json({ error: "Identità assente." }, 401);
    let body: PublishInput = {};
    try {
      body = (await request.json()) as PublishInput;
    } catch {
      return json({ error: "JSON non valido." }, 400);
    }
    const result = await writePublished(id, body, {
      ownerId,
      ifMatch: request.headers.get("if-match") || request.headers.get("x-fenix-if-match"),
    });
    if ("error" in result) {
      return json({ error: result.error }, result.status);
    }
    return json(result);
  }
  return json({ error: "Metodo non consentito." }, 405);
}
