import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { requireDb } from "@/lib/db";
import { routes } from "@/lib/db/schema";
import { routeBbox, routePayload } from "@/lib/geo/helpers";
import type { Activity, LineString } from "@/lib/geo/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = requireDb();
  const user = await getSessionUser();
  const [row] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.visibility !== "public" && row.ownerId !== user?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ route: routePayload(row), isOwner: row.ownerId === user?.id });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await requireUser();
  const db = requireDb();
  const [existing] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const geometry = (body.geometry ?? existing.geometry) as LineString;
  const [row] = await db
    .update(routes)
    .set({
      name: body.name ? String(body.name).slice(0, 120) : existing.name,
      description:
        body.description !== undefined
          ? body.description
            ? String(body.description).slice(0, 2000)
            : null
          : existing.description,
      visibility: body.visibility === "public" ? "public" : body.visibility === "private" ? "private" : existing.visibility,
      activity: (body.activity as Activity) ?? existing.activity,
      geometry,
      waypoints: body.waypoints ?? existing.waypoints,
      originalGeometry: body.originalGeometry ?? existing.originalGeometry,
      distanceM: body.stats?.distanceM ?? existing.distanceM,
      gainM: body.stats?.gainM ?? existing.gainM,
      lossM: body.stats?.lossM ?? existing.lossM,
      highM: body.stats?.highM ?? existing.highM,
      lowM: body.stats?.lowM ?? existing.lowM,
      maxGrade: body.stats?.maxGrade ?? existing.maxGrade,
      etaS: body.stats?.etaS ?? existing.etaS,
      bbox: routeBbox(geometry),
      matchConfidence: body.matchConfidence ?? existing.matchConfidence,
      updatedAt: new Date(),
    })
    .where(eq(routes.id, id))
    .returning();
  return NextResponse.json({ route: routePayload(row) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await requireUser();
  const db = requireDb();
  const [existing] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(routes).where(and(eq(routes.id, id), eq(routes.ownerId, user.id)));
  return NextResponse.json({ ok: true });
}
