import { NextRequest, NextResponse } from "next/server";
import { geocode } from "@/lib/mapbox/client";
import { rateLimit } from "@/lib/mapbox/rate-limit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`geo:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many searches." }, { status: 429 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const results = await geocode(q);
  return NextResponse.json({ results });
}
