import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth/session";
import { requireDb } from "@/lib/db";
import { routes } from "@/lib/db/schema";
import { DEFAULT_ROUTE_ACTIVITY, routeBbox, routePayload } from "@/lib/geo/helpers";
import type { LineString, Waypoint } from "@/lib/geo/types";

export async function GET() {
  const user = await requireUser();
  const db = requireDb();
  const rows = await db
    .select()
    .from(routes)
    .where(or(eq(routes.ownerId, user.id), eq(routes.visibility, "public")))
    .orderBy(desc(routes.updatedAt));
  return NextResponse.json({
    routes: rows.map(routePayload),
    userId: user.id,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.geometry) {
    return NextResponse.json({ error: "Route needs a name and geometry." }, { status: 400 });
  }
  const geometry = body.geometry as LineString;
  const waypoints = (body.waypoints ?? []) as Waypoint[];
  const stats = body.stats ?? {};
  const db = requireDb();
  const id = nanoid();
  const [row] = await db
    .insert(routes)
    .values({
      id,
      ownerId: user.id,
      name: String(body.name).slice(0, 120),
      description: body.description ? String(body.description).slice(0, 2000) : null,
      activity: DEFAULT_ROUTE_ACTIVITY,
      visibility: body.visibility === "public" ? "public" : "private",
      geometry,
      waypoints,
      originalGeometry: body.originalGeometry ?? null,
      distanceM: Number(stats.distanceM ?? 0),
      gainM: Number(stats.gainM ?? 0),
      lossM: Number(stats.lossM ?? 0),
      highM: stats.highM ?? null,
      lowM: stats.lowM ?? null,
      maxGrade: stats.maxGrade ?? null,
      etaS: stats.etaS ?? null,
      bbox: routeBbox(geometry),
      matchConfidence: body.matchConfidence ?? null,
    })
    .returning();
  return NextResponse.json({ route: routePayload(row) });
}
