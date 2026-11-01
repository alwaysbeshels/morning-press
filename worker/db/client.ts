import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb(env: Pick<Env, "DATABASE_URL">) {
  return drizzle({ client: neon(env.DATABASE_URL), schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof getDb>;
