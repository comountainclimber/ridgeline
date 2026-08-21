import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser, signOut } from "@/lib/auth/session";
import { requireDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const db = requireDb();
  const units = body.units === "metric" ? "metric" : body.units === "imperial" ? "imperial" : user.units;
  const displayName =
    typeof body.displayName === "string" ? body.displayName.slice(0, 80) : user.displayName;
  await db.update(users).set({ units, displayName }).where(eq(users.id, user.id));
  return NextResponse.json({ user: { ...user, units, displayName } });
}

export async function DELETE() {
  await signOut();
  return NextResponse.json({ ok: true });
}
