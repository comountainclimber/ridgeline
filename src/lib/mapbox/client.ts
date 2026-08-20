import type { LineString, LngLat, MapboxProfile } from "@/lib/geo/types";

const BASE = "https://api.mapbox.com";

function token() {
  const t = process.env.MAPBOX_SECRET_TOKEN;
  if (!t) throw new Error("MAPBOX_SECRET_TOKEN is not configured");
  return t;
}

export async function directionsAlong(
  points: LngLat[],
  profile: MapboxProfile,
): Promise<LineString> {
  if (points.length < 2) {
    throw new Error("Need at least two points to snap a line.");
  }
  const chunks = chunkCoords(points, 25);
  const parts: LngLat[][] = [];
  for (const chunk of chunks) {
    const path = chunk.map((c) => `${c[0]},${c[1]}`).join(";");
    const url = `${BASE}/directions/v5/mapbox/${profile}/${path}?geometries=geojson&overview=full&steps=false&access_token=${token()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`No trail found between those points (${res.status}). ${body.slice(0, 120)}`);
    }
    const json = (await res.json()) as {
      routes?: { geometry?: { coordinates?: LngLat[] } }[];
    };
    const coords = json.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      throw new Error("No trail found between those points. Try a closer click.");
    }
    parts.push(coords);
  }
  return { type: "LineString", coordinates: mergeLines(parts) };
}

export async function directionsBetween(
  a: LngLat,
  b: LngLat,
  profile: MapboxProfile,
): Promise<LineString> {
  return directionsAlong([a, b], profile);
}

export async function matchTrack(
  coords: LngLat[],
  profile: MapboxProfile,
): Promise<{ geometry: LineString; confidence: number }> {
  const chunks = chunkCoords(coords, 100);
  const parts: LngLat[][] = [];
  let confidenceSum = 0;
  let confidenceN = 0;

  for (const chunk of chunks) {
    const path = chunk.map((c) => `${c[0]},${c[1]}`).join(";");
    const radii = chunk.map(() => 25).join(";");
    const url = `${BASE}/matching/v5/mapbox/${profile}/${path}?geometries=geojson&overview=full&radiuses=${radii}&access_token=${token()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      continue;
    }
    const json = (await res.json()) as {
      matchings?: {
        confidence?: number;
        geometry?: { coordinates?: LngLat[] };
      }[];
    };
    const match = json.matchings?.[0];
    if (match?.geometry?.coordinates?.length) {
      parts.push(match.geometry.coordinates);
      if (typeof match.confidence === "number") {
        confidenceSum += match.confidence;
        confidenceN += 1;
      }
    }
  }

  if (parts.length === 0) {
    throw new Error("Could not snap that track to trails. We'll keep your original line.");
  }

  const merged = mergeLines(parts);
  return {
    geometry: { type: "LineString", coordinates: merged },
    confidence: confidenceN ? confidenceSum / confidenceN : 0,
  };
}

export async function geocode(query: string): Promise<
  { name: string; lng: number; lat: number }[]
> {
  const url = `${BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=5&types=place,poi,locality,region,mountain&access_token=${token()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features?: { place_name?: string; center?: [number, number] }[];
  };
  return (json.features ?? [])
    .filter((f) => f.center)
    .map((f) => ({
      name: f.place_name ?? "Place",
      lng: f.center![0],
      lat: f.center![1],
    }));
}

function chunkCoords(coords: LngLat[], size: number): LngLat[][] {
  if (coords.length <= size) return [coords];
  const out: LngLat[][] = [];
  let i = 0;
  while (i < coords.length) {
    const end = Math.min(i + size, coords.length);
    out.push(coords.slice(i, end));
    if (end === coords.length) break;
    i = end - 5;
  }
  return out;
}

function mergeLines(parts: LngLat[][]): LngLat[] {
  const out: LngLat[] = [];
  for (const part of parts) {
    for (const c of part) {
      const last = out[out.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
    }
  }
  return out;
}
