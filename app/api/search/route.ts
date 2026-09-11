import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";
import { withApiErrorHandling } from "@/lib/api-utils";

const { GET: searchGet } = createFromSource(source, {
  language: "english",
});

export const GET = withApiErrorHandling(searchGet, "GET /api/search");
