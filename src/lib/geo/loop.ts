import { makeWaypoint, relabelWaypoints } from "./helpers";
import { haversine, interpolate, lineDistance } from "./stats";
import type { ElevationSample, LineString, LngLat, Waypoint } from "./types";

export const LOOP_GAP_M = 75;
export const LOOP_MIN_LENGTH_M = 400;
const LOOP_GAP_FRACTION = 0.05;
const VERTEX_SNAP_M = 2;
const PIN_NEAR_M = 8;
const M_PER_DEG_LAT = 111_320;

export type LineHit = {
  /** Start vertex of the hit segment. */
  index: number;
  /** 0–1 along that segment. */
  t: number;
  coord: LngLat;
  distanceAlongM: number;
  distToLineM: number;
};

export function isClosedLoop(coords: LngLat[]): boolean {
  if (coords.length < 3) return false;
  const length = lineDistance(coords);
  if (length < LOOP_MIN_LENGTH_M) return false;
  const gap = haversine(coords[0], coords[coords.length - 1]);
  return gap <= LOOP_GAP_M && gap <= length * LOOP_GAP_FRACTION;
}

export function canRotateLoopJoin(
  geometry: LineString | null,
  bushwhackParts: LngLat[][],
): boolean {
  return Boolean(
    geometry && bushwhackParts.length === 0 && isClosedLoop(geometry.coordinates),
  );
}

export function nearestPointOnLine(coords: LngLat[], point: LngLat): LineHit | null {
  if (coords.length < 2) return null;
  let best: LineHit | null = null;
  let along = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const segLen = haversine(a, b);
    const hit = closestOnSegment(a, b, point);
    if (!best || hit.dist < best.distToLineM) {
      best = {
        index: i - 1,
        t: hit.t,
        coord: hit.coord,
        distanceAlongM: along + hit.t * segLen,
        distToLineM: hit.dist,
      };
    }
    along += segLen;
  }
  return best;
}

export function rotateClosedLine(coords: LngLat[], hit: LineHit): LngLat[] {
  const ring = dropClosingDuplicate(coords);
  if (ring.length < 3) return closeRing(coords);
  const n = ring.length;
  const index = ((hit.index % n) + n) % n;
  const a = ring[index];
  const b = ring[(index + 1) % n];
  const segLen = haversine(a, b);
  const along = hit.t * segLen;

  let verts = ring;
  let startIdx: number;
  if (along <= VERTEX_SNAP_M || hit.t <= 1e-6) {
    startIdx = index;
  } else if (segLen - along <= VERTEX_SNAP_M || hit.t >= 1 - 1e-6) {
    startIdx = (index + 1) % n;
  } else {
    verts = [...ring.slice(0, index + 1), hit.coord, ...ring.slice(index + 1)];
    startIdx = index + 1;
  }

  const rotated = [...verts.slice(startIdx), ...verts.slice(0, startIdx)];
  return closeRing(rotated);
}

export function rotateClosedLineTo(coords: LngLat[], point: LngLat): LngLat[] | null {
  const ring = dropClosingDuplicate(coords);
  if (ring.length < 3) return null;
  const hit = nearestPointOnLine(ring, point);
  if (!hit) return null;
  return rotateClosedLine(ring, hit);
}

export function rotateLoopWaypoints(
  waypoints: Waypoint[],
  point: LngLat,
  geometry: LineString,
): Waypoint[] {
  if (waypoints.length < 2) return relabelWaypoints(waypoints.slice());

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const closed =
    haversine([first.lng, first.lat], [last.lng, last.lat]) <= LOOP_GAP_M;
  const unique = closed ? waypoints.slice(0, -1) : waypoints.slice();
  const closingBushwhack = closed ? last.bushwhack : undefined;

  if (unique.length <= 1) {
    return relabelWaypoints([
      makeWaypoint(point[0], point[1], "start"),
      makeWaypoint(point[0], point[1], "end"),
    ]);
  }

  const coords = geometry.coordinates;
  const pHit = nearestPointOnLine(coords, point);
  const pDist = pHit?.distanceAlongM ?? 0;

  const located = unique.map((wp, i) => {
    const hit = nearestPointOnLine(coords, [wp.lng, wp.lat]);
    return { wp, dist: hit?.distanceAlongM ?? 0, wasStart: i === 0 };
  });

  const keep = located.filter(
    (x) => haversine([x.wp.lng, x.wp.lat], point) > PIN_NEAR_M,
  );
  const after = keep.filter((x) => x.dist > pDist + 1);
  const before = keep.filter((x) => x.dist <= pDist + 1);
  const nextAfterSplit = after[0] ?? before[0];
  const endBushwhack = incomingFlag(nextAfterSplit, closingBushwhack);

  const retag = (x: (typeof located)[number]): Waypoint => {
    const bushwhack = incomingFlag(x, closingBushwhack);
    return {
      ...x.wp,
      ...(bushwhack ? { bushwhack: true } : { bushwhack: undefined }),
    };
  };

  return relabelWaypoints([
    makeWaypoint(point[0], point[1], "start"),
    ...after.map(retag),
    ...before.map(retag),
    makeWaypoint(point[0], point[1], "end", endBushwhack ? { bushwhack: true } : undefined),
  ]);
}

export function rotateElevationSamples(
  samples: ElevationSample[],
  splitDistanceM: number,
): ElevationSample[] {
  if (samples.length < 2) return samples.slice();
  const first = samples[0];
  const last = samples[samples.length - 1];
  const total = last.distanceM;
  if (total <= 0) return samples.slice();
  if (splitDistanceM <= VERTEX_SNAP_M || splitDistanceM >= total - VERTEX_SNAP_M) {
    return samples.slice();
  }

  const closed = haversine([first.lng, first.lat], [last.lng, last.lat]) <= VERTEX_SNAP_M;
  const ring = closed ? samples.slice(0, -1) : samples;
  const atSplit = sampleAt(ring, splitDistanceM);
  const start: ElevationSample = { ...atSplit, distanceM: 0, grade: 0 };
  const remapped = ring
    .filter((s) => Math.abs(s.distanceM - splitDistanceM) > VERTEX_SNAP_M)
    .map((s) => ({
      ...s,
      distanceM: s.distanceM >= splitDistanceM ? s.distanceM - splitDistanceM : s.distanceM - splitDistanceM + total,
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
  const end: ElevationSample = { ...atSplit, distanceM: total };
  return withGrades([start, ...remapped, end]);
}

function incomingFlag(
  pin: { wasStart: boolean; wp: Waypoint } | undefined,
  closingBushwhack: boolean | undefined,
): boolean {
  if (!pin) return false;
  return Boolean(pin.wasStart ? closingBushwhack : pin.wp.bushwhack);
}

function dropClosingDuplicate(coords: LngLat[]): LngLat[] {
  if (coords.length < 2) return coords.slice();
  if (haversine(coords[0], coords[coords.length - 1]) <= VERTEX_SNAP_M) {
    return coords.slice(0, -1);
  }
  return coords.slice();
}

function closeRing(coords: LngLat[]): LngLat[] {
  const ring = dropClosingDuplicate(coords);
  if (ring.length === 0) return [];
  return [...ring, ring[0]];
}

function closestOnSegment(
  a: LngLat,
  b: LngLat,
  p: LngLat,
): { t: number; coord: LngLat; dist: number } {
  const originLat = p[1];
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  const ax = a[0] * mPerDegLng;
  const ay = a[1] * M_PER_DEG_LAT;
  const bx = b[0] * mPerDegLng;
  const by = b[1] * M_PER_DEG_LAT;
  const px = p[0] * mPerDegLng;
  const py = p[1] * M_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  const coord = interpolate(a, b, t);
  return { t, coord, dist: haversine(p, coord) };
}

function sampleAt(samples: ElevationSample[], distanceM: number): ElevationSample {
  if (distanceM <= samples[0].distanceM) return { ...samples[0], distanceM };
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].distanceM >= distanceM) {
      const a = samples[i - 1];
      const b = samples[i];
      const span = b.distanceM - a.distanceM;
      const t = span > 0 ? (distanceM - a.distanceM) / span : 0;
      return {
        distanceM,
        elevationM: a.elevationM + (b.elevationM - a.elevationM) * t,
        grade: 0,
        lng: a.lng + (b.lng - a.lng) * t,
        lat: a.lat + (b.lat - a.lat) * t,
      };
    }
  }
  return { ...samples[samples.length - 1], distanceM };
}

function withGrades(samples: ElevationSample[]): ElevationSample[] {
  return samples.map((s, i) => {
    if (i === 0) return { ...s, grade: 0 };
    const run = s.distanceM - samples[i - 1].distanceM;
    const grade = run > 0.5 ? ((s.elevationM - samples[i - 1].elevationM) / run) * 100 : 0;
    return { ...s, grade };
  });
}
