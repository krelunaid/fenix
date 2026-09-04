import { handleReleaseCollection } from "../../src/lib/release/http.ts";

export default async (req: Request) => handleReleaseCollection(req);

export const config = {
  path: "/api/release",
};
