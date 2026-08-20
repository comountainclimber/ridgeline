import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { routes } from "@/lib/db/schema";
import { routePayload } from "@/lib/geo/helpers";

export async function GET() {
  const db = requireDb();
  const rows = await db
    .select()
    .from(routes)
    .where(eq(routes.visibility, "public"))
    .orderBy(desc(routes.updatedAt))
    .limit(24);
  const editorial = rows.filter((r) => r.ownerId == null);
  const list = editorial.length ? editorial : rows;
  return NextResponse.json({ routes: list.map(routePayload) });
}
