import { toGpx } from "./gpx";
import type { LineString } from "./types";

export const GPX_IMPORT_KEY = "ridgeline-gpx-import";

export type GpxPoint = {
  lng: number;
  lat: number;
  ele: number | null;
  time: string | null;
};

export type GpxTrack = {
  name: string | null;
  points: GpxPoint[];
};

export type GpxImportPayload = {
  name: string;
  geometry: LineString;
};

export function parseGpxTrack(xmlText: string): GpxTrack {
  const nameMatch = xmlText.match(/<name>([^<]+)<\/name>/i);
  const name = nameMatch?.[1]?.trim() || null;
  const points: GpxPoint[] = [];
  const re =
    /<(trkpt|rtept)\s+([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/\1>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xmlText))) {
    const attrs = m[2] ?? "";
    const inner = m[3] ?? "";
    const lat = parseFloat(attr(attrs, "lat") ?? "");
    const lng = parseFloat(attr(attrs, "lon") ?? attr(attrs, "lng") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const eleRaw = innerTag(inner, "ele");
    const ele = eleRaw != null ? parseFloat(eleRaw) : NaN;
    const timeRaw = innerTag(inner, "time");
    points.push({
      lng,
      lat,
      ele: Number.isFinite(ele) ? ele : null,
      time: timeRaw && timeRaw.length > 0 ? timeRaw : null,
    });
  }
  if (points.length < 1) {
    throw new Error("No track or route found in that GPX file.");
  }
  return { name, points };
}

export function firstPointTimeMs(track: GpxTrack): number | null {
  for (const p of track.points) {
    if (!p.time) continue;
    const ms = Date.parse(p.time);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

export function sortTracksByFirstTime<T>(
  items: T[],
  getTrack: (item: T) => GpxTrack,
): T[] {
  return items
    .map((item, index) => ({ item, index, t: firstPointTimeMs(getTrack(item)) }))
    .sort((a, b) => {
      if (a.t != null && b.t != null) return a.t - b.t || a.index - b.index;
      if (a.t != null) return -1;
      if (b.t != null) return 1;
      return a.index - b.index;
    })
    .map((row) => row.item);
}

export function mergeGpxTracks(tracks: GpxTrack[]): GpxTrack {
  if (tracks.length === 0) {
    throw new Error("Add at least one GPX file.");
  }
  const sorted = sortTracksByFirstTime(tracks, (t) => t);
  const points = sorted.flatMap((t) => t.points);
  if (points.length < 2) {
    throw new Error("Need at least two points to merge those GPX files.");
  }
  return {
    name: sorted.find((t) => t.name)?.name ?? null,
    points,
  };
}

export function trackToLineString(track: GpxTrack): LineString {
  return {
    type: "LineString",
    coordinates: track.points.map((p) => [p.lng, p.lat]),
  };
}

export function mergedTrackToGpx(track: GpxTrack, name: string): string {
  return toGpx({
    name,
    coordinates: track.points.map((p) => [p.lng, p.lat]),
    elevations: track.points.map((p) => p.ele),
    times: track.points.map((p) => p.time),
    desc: "Merged on Ridgeline",
  });
}

export function stashGpxImport(payload: GpxImportPayload): void {
  sessionStorage.setItem(GPX_IMPORT_KEY, JSON.stringify(payload));
}

export function readGpxImport(): GpxImportPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(GPX_IMPORT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GpxImportPayload;
    const coords = parsed.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "Merged track",
      geometry: { type: "LineString", coordinates: coords },
    };
  } catch {
    return null;
  }
}

export function clearGpxImport(): void {
  sessionStorage.removeItem(GPX_IMPORT_KEY);
}

function attr(attrs: string, name: string): string | null {
  const dq = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`, "i"));
  if (dq?.[1]) return dq[1];
  const sq = attrs.match(new RegExp(`${name}\\s*=\\s*'([^']+)'`, "i"));
  return sq?.[1] ?? null;
}

function innerTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  const value = m?.[1]?.trim();
  return value ? value : null;
}
