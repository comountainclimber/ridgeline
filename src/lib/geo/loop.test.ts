import { describe, expect, it } from "vitest";
import {
  canRotateLoopJoin,
  isClosedLoop,
  nearestPointOnLine,
  rotateClosedLine,
  rotateClosedLineTo,
  rotateElevationSamples,
  rotateLoopWaypoints,
} from "./loop";
import { haversine, lineDistance } from "./stats";
import type { ElevationSample, LineString, LngLat, Waypoint } from "./types";

const A: LngLat = [0, 0];
const B: LngLat = [0.01, 0];
const C: LngLat = [0.01, 0.01];
const D: LngLat = [0, 0.01];

const square: LngLat[] = [A, B, C, D, A];

function wp(
  id: string,
  coord: LngLat,
  kind: Waypoint["kind"],
  bushwhack?: boolean,
): Waypoint {
  return { id, lng: coord[0], lat: coord[1], kind, ...(bushwhack ? { bushwhack: true } : {}) };
}

function sample(
  distanceM: number,
  elevationM: number,
  lng: number,
  lat: number,
): ElevationSample {
  return { distanceM, elevationM, grade: 0, lng, lat };
}

describe("isClosedLoop", () => {
  it("accepts a closed ring long enough to be a hike", () => {
    expect(isClosedLoop(square)).toBe(true);
  });

  it("rejects an open line", () => {
    expect(isClosedLoop([A, B, C, D])).toBe(false);
  });

  it("rejects a short closed wiggle", () => {
    expect(
      isClosedLoop([
        [0, 0],
        [0.0002, 0],
        [0.0002, 0.0002],
        [0, 0],
      ]),
    ).toBe(false);
  });

  it("rejects fewer than three points", () => {
    expect(isClosedLoop([A, A])).toBe(false);
  });
});

describe("canRotateLoopJoin", () => {
  it("requires a trail-only closed line", () => {
    const geometry: LineString = { type: "LineString", coordinates: square };
    expect(canRotateLoopJoin(geometry, [])).toBe(true);
    expect(canRotateLoopJoin(geometry, [[A, B]])).toBe(false);
    expect(canRotateLoopJoin(null, [])).toBe(false);
  });
});

describe("nearestPointOnLine", () => {
  it("hits the midpoint of a segment", () => {
    const hit = nearestPointOnLine(square, [0.005, 0.00005]);
    expect(hit).not.toBeNull();
    expect(hit?.index).toBe(0);
    expect(hit?.t).toBeGreaterThan(0.4);
    expect(hit?.t).toBeLessThan(0.6);
    expect(hit?.coord[0]).toBeCloseTo(0.005, 3);
  });

  it("returns a vertex when the query sits on one", () => {
    const hit = nearestPointOnLine(square, C);
    expect(hit).not.toBeNull();
    expect(hit?.coord[0]).toBeCloseTo(C[0], 5);
    expect(hit?.coord[1]).toBeCloseTo(C[1], 5);
  });
});

describe("rotateClosedLine", () => {
  it("starts at an existing vertex and closes the ring", () => {
    const hit = nearestPointOnLine(square.slice(0, -1), C);
    expect(hit).not.toBeNull();
    const rotated = rotateClosedLine(square, hit!);
    expect(rotated[0]).toEqual(rotated[rotated.length - 1]);
    expect(rotated[0][0]).toBeCloseTo(C[0], 5);
    expect(rotated[0][1]).toBeCloseTo(C[1], 5);
    expect(rotated.slice(0, -1).map((c) => c.map((n) => n.toFixed(4)))).toEqual(
      [C, D, A, B].map((c) => c.map((n) => n.toFixed(4))),
    );
    expect(lineDistance(rotated)).toBeCloseTo(lineDistance(square), 0);
  });

  it("inserts a mid-segment join once", () => {
    const p: LngLat = [0.005, 0];
    const hit = nearestPointOnLine(square.slice(0, -1), p);
    expect(hit).not.toBeNull();
    const rotated = rotateClosedLine(square, hit!);
    expect(rotated[0][0]).toBeCloseTo(0.005, 3);
    expect(rotated[rotated.length - 1][0]).toBeCloseTo(rotated[0][0], 5);
    expect(rotated.length).toBe(square.length + 1);
    expect(lineDistance(rotated)).toBeCloseTo(lineDistance(square), 0);
  });
});

describe("rotateClosedLineTo", () => {
  it("rotates to the nearest point on the ring", () => {
    const rotated = rotateClosedLineTo(square, [0.012, 0.01]);
    expect(rotated).not.toBeNull();
    expect(rotated![0][0]).toBeCloseTo(C[0], 3);
    expect(rotated![0][1]).toBeCloseTo(C[1], 3);
  });
});

describe("rotateLoopWaypoints", () => {
  const geometry: LineString = { type: "LineString", coordinates: square };

  it("moves both pins on a two-pin GPX loop", () => {
    const next = rotateLoopWaypoints(
      [wp("s", A, "start"), wp("e", A, "end")],
      C,
      geometry,
    );
    expect(next).toHaveLength(2);
    expect(next[0].kind).toBe("start");
    expect(next[1].kind).toBe("end");
    expect(next[0].lng).toBeCloseTo(C[0], 5);
    expect(next[1].lat).toBeCloseTo(C[1], 5);
  });

  it("rotates vias around a join on a split leg and keeps bushwhack", () => {
    const next = rotateLoopWaypoints(
      [
        wp("a", A, "start"),
        wp("b", B, "via"),
        wp("c", C, "via", true),
        wp("d", A, "end"),
      ],
      [0.01, 0.005],
      geometry,
    );
    expect(next.map((p) => [Number(p.lng.toFixed(3)), Number(p.lat.toFixed(3)), Boolean(p.bushwhack)])).toEqual([
      [0.01, 0.005, false],
      [0.01, 0.01, true],
      [0, 0, false],
      [0.01, 0, false],
      [0.01, 0.005, true],
    ]);
    expect(next[0].kind).toBe("start");
    expect(next[next.length - 1].kind).toBe("end");
  });
});

describe("rotateElevationSamples", () => {
  it("rebases distance so the split becomes the origin", () => {
    const ab = haversine(A, B);
    const bc = haversine(B, C);
    const cd = haversine(C, D);
    const da = haversine(D, A);
    const samples = [
      sample(0, 100, ...A),
      sample(ab, 110, ...B),
      sample(ab + bc, 120, ...C),
      sample(ab + bc + cd, 115, ...D),
      sample(ab + bc + cd + da, 100, ...A),
    ];
    const rotated = rotateElevationSamples(samples, ab + bc);
    expect(rotated[0].distanceM).toBe(0);
    expect(rotated[0].lng).toBeCloseTo(C[0], 4);
    expect(rotated[0].lat).toBeCloseTo(C[1], 4);
    expect(rotated[rotated.length - 1].distanceM).toBeCloseTo(samples[samples.length - 1].distanceM, 4);
    expect(rotated[rotated.length - 1].lng).toBeCloseTo(C[0], 4);
    const atOldStart = rotated.find((s) => s.lng === 0 && s.lat === 0 && s.distanceM > 0);
    expect(atOldStart?.distanceM).toBeCloseTo(cd + da, 0);
  });
});
