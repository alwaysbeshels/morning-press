import { createServer } from "vite";

const server = await createServer({
  configFile: new URL("../vite.demo.config.ts", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

try {
  await server.ssrLoadModule("/scripts/build-demo-editions.ts");
} finally {
  await server.close();
}
