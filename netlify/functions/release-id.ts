import { handleReleaseItem } from "../../src/lib/release/http.ts";

export default async (req: Request, context: { params?: { id?: string } }) => {
  const id =
    context.params?.id || new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  return handleReleaseItem(req, id);
};

export const config = {
  path: "/api/release/:id",
};
