import { nanoid } from "nanoid";
import type { LineString, RouteStats, SavedRoute, Waypoint } from "./types";
import { bboxOf } from "./stats";

/** Leftover NOT NULL column; tracks are not sport-typed. */
export const DEFAULT_ROUTE_ACTIVITY = "hike";

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
  opts?: { bushwhack?: boolean },
): Waypoint {
  return {
    id: nanoid(8),
    lng,
    lat,
    kind,
    ...(opts?.bushwhack ? { bushwhack: true } : {}),
  };
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

export function routePayload(row: {
  id: string;
  ownerId: string | null;
  name: string;
  description: string | null;
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
