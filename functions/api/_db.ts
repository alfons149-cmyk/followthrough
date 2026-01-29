import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export type Env = { DB: D1Database };

export function getDb(env: Env): DrizzleD1Database {
  return drizzle(env.DB);
}

