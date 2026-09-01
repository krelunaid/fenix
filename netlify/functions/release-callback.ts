import { handleReleaseCallback } from "../../src/lib/release/http.ts";

export default async (req: Request) => handleReleaseCallback(req);

export const config = {
  path: "/api/release/callback",
};
