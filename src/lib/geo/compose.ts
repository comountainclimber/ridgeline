import { relabelWaypoints } from "./helpers";
import type { LineString, LngLat, Waypoint } from "./types";

export type RouteRun = {
  bushwhack: boolean;
  coords: LngLat[];
};

export type ComposedRoute = {
  geometry: LineString;
  snapParts: LngLat[][];
  bushwhackParts: LngLat[][];
};

export type SnapFn = (coords: LngLat[]) => Promise<LineString>;

export function isBushwhackLeg(point: Waypoint | undefined): boolean {
  return Boolean(point?.bushwhack);
}

export function straightLine(coords: LngLat[]): LineString {
  return { type: "LineString", coordinates: coords.slice() };
}

export function mergeLineParts(parts: LngLat[][]): LngLat[] {
  const out: LngLat[] = [];
  for (const part of parts) {
    for (const c of part) {
      const last = out[out.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
    }
  }
  return out;
}

/** Consecutive same-mode pins become one run. The start pin's flag is ignored. */
export function splitRouteRuns(waypoints: Waypoint[]): RouteRun[] {
  if (waypoints.length < 2) return [];
  const runs: RouteRun[] = [];
  let start = 0;
  let bushwhack = isBushwhackLeg(waypoints[1]);
  for (let i = 2; i < waypoints.length; i++) {
    const next = isBushwhackLeg(waypoints[i]);
    if (next === bushwhack) continue;
    runs.push({ bushwhack, coords: coordsOf(waypoints.slice(start, i)) });
    start = i - 1;
    bushwhack = next;
  }
  runs.push({ bushwhack, coords: coordsOf(waypoints.slice(start)) });
  return runs;
}

/**
 * Reverse pins and shift each `bushwhack` flag onto the new destination
 * so every physical leg keeps its mode.
 */
export function reverseWaypointsPreservingLegs(points: Waypoint[]): Waypoint[] {
  if (points.length < 2) return relabelWaypoints([...points].reverse());
  const n = points.length;
  return relabelWaypoints(
    [...points].reverse().map((p, i) => {
      const incoming = i === 0 ? undefined : points[n - i];
      return {
        ...p,
        bushwhack: isBushwhackLeg(incoming) ? true : undefined,
      };
    }),
  );
}

export async function composeRouteGeometry(
  waypoints: Waypoint[],
  snap: SnapFn,
): Promise<ComposedRoute> {
  const runs = splitRouteRuns(waypoints);
  if (runs.length === 0) {
    return emptyComposed();
  }

  const resolved = await Promise.all(
    runs.map(async (run) => {
      if (run.bushwhack) {
        return { bushwhack: true as const, coords: straightLine(run.coords).coordinates };
      }
      const line = await snap(run.coords);
      return { bushwhack: false as const, coords: line.coordinates };
    }),
  );

  const snapParts: LngLat[][] = [];
  const bushwhackParts: LngLat[][] = [];
  const parts: LngLat[][] = [];
  for (const run of resolved) {
    parts.push(run.coords);
    if (run.bushwhack) bushwhackParts.push(run.coords);
    else snapParts.push(run.coords);
  }

  return {
    geometry: { type: "LineString", coordinates: mergeLineParts(parts) },
    snapParts,
    bushwhackParts,
  };
}

export function emptyComposed(): ComposedRoute {
  return {
    geometry: { type: "LineString", coordinates: [] },
    snapParts: [],
    bushwhackParts: [],
  };
}

function coordsOf(points: Waypoint[]): LngLat[] {
  return points.map((p) => [p.lng, p.lat]);
}
