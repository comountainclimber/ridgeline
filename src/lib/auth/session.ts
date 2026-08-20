import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { Units } from "@/lib/geo/types";

const COOKIE = "ridgeline_uid";

export type SessionUser = {
  id: string;
  displayName: string | null;
  units: Units;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const db = requireDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.displayName,
    units: row.units === "metric" ? "metric" : "imperial",
  };
}

export async function requireUser(): Promise<SessionUser> {
  const existing = await getSessionUser();
  if (existing) return existing;
  return createGuestUser();
}

export async function createGuestUser(displayName?: string): Promise<SessionUser> {
  const db = requireDb();
  const id = nanoid();
  await db.insert(users).values({
    id,
    displayName: displayName ?? null,
    units: "imperial",
  });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { id, displayName: displayName ?? null, units: "imperial" };
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
