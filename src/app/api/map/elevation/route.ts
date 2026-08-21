import { NextRequest, NextResponse } from "next/server";
import { fetchElevations } from "@/lib/geo/elevation";
import type { LngLat } from "@/lib/geo/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const coordinates = body?.coordinates as LngLat[] | undefined;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return NextResponse.json({ elevations: [] });
  }
  try {
    const elevations = await fetchElevations(coordinates);
    return NextResponse.json({ elevations });
  } catch {
    return NextResponse.json({ error: "Elevation unavailable" }, { status: 502 });
  }
}
