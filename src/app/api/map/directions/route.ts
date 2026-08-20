import { NextRequest, NextResponse } from "next/server";
import { ACTIVITY_META, ACTIVITIES } from "@/lib/geo/types";
import { directionsAlong } from "@/lib/mapbox/client";
import { rateLimit } from "@/lib/mapbox/rate-limit";

function isAct(v: unknown): v is (typeof ACTIVITIES)[number] {
  return typeof v === "string" && (ACTIVITIES as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`dir:${ip}`, 40, 60_000)) {
    return NextResponse.json({ error: "Too many routing requests." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const activity = body?.activity;
  const waypoints = body?.waypoints as { lng: number; lat: number }[] | undefined;
  if (!isAct(activity) || !Array.isArray(waypoints) || waypoints.length < 2) {
    return NextResponse.json(
      { error: "Need an activity and at least two waypoints." },
      { status: 400 },
    );
  }
  try {
    const geometry = await directionsAlong(
      waypoints.map((w) => [w.lng, w.lat]),
      ACTIVITY_META[activity].profile,
    );
    return NextResponse.json({ geometry, profile: ACTIVITY_META[activity].profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Routing failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
