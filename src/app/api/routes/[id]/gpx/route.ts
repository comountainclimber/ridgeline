import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { requireDb } from "@/lib/db";
import { routes } from "@/lib/db/schema";
import { toGpx } from "@/lib/geo/gpx";
import type { Activity, LineString } from "@/lib/geo/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = requireDb();
  const user = await getSessionUser();
  const [row] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.visibility !== "public" && row.ownerId !== user?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const geometry = row.geometry as LineString;
  const xml = toGpx({
    name: row.name,
    activity: row.activity as Activity,
    coordinates: geometry.coordinates,
  });
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${row.name.replace(/[^\w\s-]+/g, "")}.gpx"`,
    },
  });
}
