// Bounds transport bytes before JSON parsing, independently of the HTML
// character contract. Allows 120k HTML even when JSON escapes every character.
export const MAX_REQUEST_BYTES = 1024 * 1024;

export async function readWorkerBody(req) {
  const tooLarge = () => Object.assign(new Error("Richiesta troppo grande."), { status: 413 });
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    req.resume();
    throw tooLarge();
  }
  const chunks = [];
  let bytes = 0;
  // Do not destroy the HTTP socket on early exit: the caller must send 413.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) {
      req.resume();
      throw tooLarge();
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("JSON non valido"), { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("Serve un oggetto JSON."), { status: 400 });
  }
  return body;
}
