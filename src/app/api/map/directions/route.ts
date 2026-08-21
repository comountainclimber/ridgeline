import { NextRequest, NextResponse } from "next/server";
import { SNAP_PROFILE } from "@/lib/geo/types";
import { directionsAlong } from "@/lib/mapbox/client";
import { rateLimit } from "@/lib/mapbox/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`dir:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "Too many routing requests." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const waypoints = body?.waypoints as { lng: number; lat: number }[] | undefined;
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return NextResponse.json(
      { error: "Need at least two waypoints." },
      { status: 400 },
    );
  }
  try {
    const geometry = await directionsAlong(
      waypoints.map((w) => [w.lng, w.lat]),
      SNAP_PROFILE,
    );
    return NextResponse.json({ geometry, profile: SNAP_PROFILE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Routing failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
