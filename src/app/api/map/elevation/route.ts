import { NextRequest, NextResponse } from "next/server";
import type { LngLat } from "@/lib/geo/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const coordinates = body?.coordinates as LngLat[] | undefined;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return NextResponse.json({ elevations: [] });
  }
  const sample = coordinates.filter((_, i) => i % Math.ceil(coordinates.length / 80) === 0);
  const lats = sample.map((c) => c[1]).join(",");
  const lngs = sample.map((c) => c[0]).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Elevation unavailable" }, { status: 502 });
  }
  const json = (await res.json()) as { elevation?: number[] };
  const sampled = json.elevation ?? [];
  const elevations: (number | null)[] = coordinates.map((_, i) => {
    const idx = Math.round((i / Math.max(1, coordinates.length - 1)) * (sampled.length - 1));
    return sampled[idx] ?? null;
  });
  return NextResponse.json({ elevations });
}
