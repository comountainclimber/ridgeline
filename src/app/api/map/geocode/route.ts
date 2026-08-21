import { NextRequest, NextResponse } from "next/server";
import { geocode } from "@/lib/mapbox/client";
import { rateLimit } from "@/lib/mapbox/rate-limit";
import type { LngLat } from "@/lib/geo/types";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`geo:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many searches." }, { status: 429 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const proximity: LngLat | null =
    Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  const results = await geocode(q, proximity);
  return NextResponse.json({ results });
}
