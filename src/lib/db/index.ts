import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

export const db = url
  ? drizzle(neon(url), { schema })
  : (null as unknown as ReturnType<typeof drizzle>);

export function requireDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  return db;
}
