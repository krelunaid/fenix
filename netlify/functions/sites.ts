import { handleSiteRequest } from "../../src/lib/projects/sites-http.ts";

export default async (req: Request, context: { params?: { id?: string } }) => {
  const id =
    context.params?.id || new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  return handleSiteRequest(req, id);
};

export const config = {
  path: "/api/sites/:id",
};
