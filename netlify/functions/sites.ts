import { readPublished, writePublished } from "../../src/lib/projects/published-store.ts";
import type { PublishInput } from "../../src/lib/projects/published.ts";

export default async (req: Request, context: { params?: { id?: string } }) => {
  const id =
    context.params?.id || new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  if (req.method === "GET") {
    const snap = await readPublished(id);
    if (!snap) {
      return Response.json({ error: "Sito non trovato" }, { status: 404 });
    }
    return Response.json(snap, { headers: { "Cache-Control": "no-store" } });
  }
  if (req.method === "PUT") {
    let body: PublishInput = {};
    try {
      body = (await req.json()) as PublishInput;
    } catch {
      return Response.json({ error: "JSON non valido." }, { status: 400 });
    }
    const result = await writePublished(id, body);
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json({ error: "Metodo non consentito." }, { status: 405 });
};

export const config = {
  path: "/api/sites/:id",
};
