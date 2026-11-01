import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".dev.vars");
} catch {
  // En CI, DATABASE_URL est fourni par l'environnement.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./worker/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
