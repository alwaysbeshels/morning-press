import { Hono } from "hono";
import { buildDesignPreview, designPreviewSchema, renderDesignPreview } from "../../edition/preview";
import { newspaperHtmlCsp } from "../../edition/html";
import { jsonError, type AppEnv } from "../context";

export const newspaperPreviewRoutes = new Hono<AppEnv>().get("/", (c) => {
  const parsed = designPreviewSchema.safeParse(c.req.query());
  if (!parsed.success) return jsonError(c, 422, "invalidSettings");
  const nonce = crypto.randomUUID();
  const paper = buildDesignPreview(parsed.data, parsed.data.language);
  return c.html(renderDesignPreview(paper, nonce), 200, {
    "Content-Security-Policy": newspaperHtmlCsp(nonce),
    "Cache-Control": "private, no-store",
    "X-Frame-Options": "SAMEORIGIN",
  });
});
