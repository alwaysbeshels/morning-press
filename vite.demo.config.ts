import { cpSync, createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
import type { ServerResponse } from "node:http";

process.env.VITE_DEMO = "true";
process.env.DEMO_BASE ??= "/morning-press/";

const demoOutput = fileURLToPath(new URL("./demo-output", import.meta.url));

function contentType(file: string): string {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function serveDemo(req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  const path = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");
  const marker = "/demo/";
  const index = path.indexOf(marker);
  if (index < 0) return next();
  const relative = path.slice(index + marker.length);
  if (!relative || relative.includes("..")) return next();
  const file = join(demoOutput, relative);
  if (!existsSync(file) || !statSync(file).isFile()) return next();
  res.setHeader("Content-Type", contentType(file));
  res.setHeader("Cache-Control", "no-cache");
  createReadStream(file).pipe(res);
}

function demoSite(): Plugin {
  let outDir = "";
  return {
    name: "demo-site",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const base = (process.env.DEMO_BASE ?? "/morning-press/").replace(/\/?$/, "/");
        const doubled = `${base.slice(0, -1)}${base}`;
        const png = `<link rel="icon" type="image/png" sizes="192x192" href="${base}icons/icon-192.png" />`;
        const withIcon = html.includes('type="image/png"') ? html : html.replace("<link rel=\"icon\"", `${png}\n    <link rel="icon"`);
        return withIcon
          .split(doubled).join(base)
          .replace('content="noindex, nofollow"', 'content="index, follow"')
          .replace(/\s*<link rel="manifest"[^>]*>/, "");
      },
    },
    configureServer(server) {
      server.middlewares.use(serveDemo);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveDemo);
    },
    closeBundle() {
      if (!existsSync(demoOutput)) return;
      cpSync(demoOutput, join(outDir, "demo"), { recursive: true });
      const index = join(outDir, "index.html");
      if (existsSync(index)) cpSync(index, join(outDir, "404.html"));
      writeFileSync(join(outDir, ".nojekyll"), "");
    },
  };
}

export default defineConfig({
  base: process.env.DEMO_BASE,
  plugins: [react(), tailwindcss(), demoSite()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
