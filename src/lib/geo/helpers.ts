import { nanoid } from "nanoid";
import type { Activity, LineString, RouteStats, SavedRoute, Waypoint } from "@/lib/geo/types";
import { ACTIVITIES } from "@/lib/geo/types";
import { bboxOf } from "@/lib/geo/stats";

export function emptyStats(): RouteStats {
  return {
    distanceM: 0,
    gainM: 0,
    lossM: 0,
    highM: null,
    lowM: null,
    maxGrade: null,
    avgUpGrade: null,
    etaS: 0,
  };
}

export function makeWaypoint(
  lng: number,
  lat: number,
  kind: Waypoint["kind"],
): Waypoint {
  return { id: nanoid(8), lng, lat, kind };
}

export function relabelWaypoints(points: Waypoint[]): Waypoint[] {
  return points.map((p, i) => ({
    ...p,
    kind: i === 0 ? "start" : i === points.length - 1 ? "end" : "via",
    label:
      i === 0
        ? "Start"
        : i === points.length - 1
          ? "End"
          : `Via ${i}`,
  }));
}

export function isActivity(value: string): value is Activity {
  return (ACTIVITIES as readonly string[]).includes(value);
}

export function routePayload(row: {
  id: string;
  ownerId: string | null;
  name: string;
  description: string | null;
  activity: string;
  visibility: string;
  geometry: unknown;
  waypoints: unknown;
  originalGeometry: unknown;
  distanceM: number;
  gainM: number;
  lossM: number;
  highM: number | null;
  lowM: number | null;
  maxGrade: number | null;
  etaS: number | null;
  matchConfidence: number | null;
  createdAt: Date;
  updatedAt: Date;
}): SavedRoute {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    activity: isActivity(row.activity) ? row.activity : "hike",
    visibility: row.visibility === "public" ? "public" : "private",
    geometry: row.geometry as LineString,
    originalGeometry: (row.originalGeometry as LineString | null) ?? null,
    waypoints: (row.waypoints as Waypoint[]) ?? [],
    stats: {
      distanceM: row.distanceM,
      gainM: row.gainM,
      lossM: row.lossM,
      highM: row.highM,
      lowM: row.lowM,
      maxGrade: row.maxGrade,
      avgUpGrade: null,
      etaS: row.etaS ?? 0,
    },
    matchConfidence: row.matchConfidence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function routeBbox(geometry: LineString) {
  return bboxOf(geometry.coordinates);
}
