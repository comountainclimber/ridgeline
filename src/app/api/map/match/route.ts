import { NextRequest, NextResponse } from "next/server";
import { ACTIVITY_META, ACTIVITIES, type LngLat } from "@/lib/geo/types";
import { matchTrack } from "@/lib/mapbox/client";
import { rateLimit } from "@/lib/mapbox/rate-limit";

function isAct(v: unknown): v is (typeof ACTIVITIES)[number] {
  return typeof v === "string" && (ACTIVITIES as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`match:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many matching requests." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const activity = body?.activity;
  const coordinates = body?.coordinates as LngLat[] | undefined;
  if (!isAct(activity) || !Array.isArray(coordinates) || coordinates.length < 2) {
    return NextResponse.json({ error: "Need coordinates to snap." }, { status: 400 });
  }
  if (coordinates.length > 5000) {
    return NextResponse.json({ error: "Track is too long to snap in one go." }, { status: 400 });
  }
  try {
    const result = await matchTrack(coordinates, ACTIVITY_META[activity].profile);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Matching failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
