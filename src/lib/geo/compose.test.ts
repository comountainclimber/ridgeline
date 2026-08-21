import { describe, expect, it, vi } from "vitest";
import {
  composeRouteGeometry,
  reverseWaypointsPreservingLegs,
  splitRouteRuns,
  straightLine,
} from "./compose";
import { haversine, lineDistance } from "./stats";
import type { LineString, LngLat, Waypoint } from "./types";

function wp(
  id: string,
  lng: number,
  lat: number,
  kind: Waypoint["kind"],
  bushwhack?: boolean,
): Waypoint {
  return { id, lng, lat, kind, ...(bushwhack ? { bushwhack: true } : {}) };
}

describe("splitRouteRuns", () => {
  it("returns nothing with fewer than two pins", () => {
    expect(splitRouteRuns([])).toEqual([]);
    expect(splitRouteRuns([wp("a", 0, 0, "start")])).toEqual([]);
  });

  it("groups mixed trail / bushwhack / trail runs", () => {
    const runs = splitRouteRuns([
      wp("a", 0, 0, "start"),
      wp("b", 1, 0, "via"),
      wp("c", 2, 0, "via", true),
      wp("d", 3, 0, "via", true),
      wp("e", 4, 0, "end"),
    ]);
    expect(runs).toEqual([
      { bushwhack: false, coords: [[0, 0], [1, 0]] },
      { bushwhack: true, coords: [[1, 0], [2, 0], [3, 0]] },
      { bushwhack: false, coords: [[3, 0], [4, 0]] },
    ]);
  });

  it("treats a missing flag as trail", () => {
    const runs = splitRouteRuns([
      wp("a", 0, 0, "start"),
      wp("b", 1, 0, "end"),
    ]);
    expect(runs).toEqual([{ bushwhack: false, coords: [[0, 0], [1, 0]] }]);
  });

  it("ignores the start pin's bushwhack flag", () => {
    const runs = splitRouteRuns([
      wp("a", 0, 0, "start", true),
      wp("b", 1, 0, "end"),
    ]);
    expect(runs[0]?.bushwhack).toBe(false);
  });
});

describe("straightLine", () => {
  it("matches haversine between pins", () => {
    const a: LngLat = [-105.8172, 39.6336];
    const b: LngLat = [-105.8172, 39.6436];
    const line = straightLine([a, b]);
    expect(lineDistance(line.coordinates)).toBeCloseTo(haversine(a, b));
  });
});

describe("reverseWaypointsPreservingLegs", () => {
  it("keeps each leg's mode after reverse", () => {
    const reversed = reverseWaypointsPreservingLegs([
      wp("a", 0, 0, "start"),
      wp("b", 1, 0, "via"),
      wp("c", 2, 0, "via", true),
      wp("d", 3, 0, "end"),
    ]);
    expect(reversed.map((p) => [p.lng, Boolean(p.bushwhack)])).toEqual([
      [3, false],
      [2, false],
      [1, true],
      [0, false],
    ]);
    expect(splitRouteRuns(reversed).map((r) => r.bushwhack)).toEqual([false, true, false]);
  });
});

describe("composeRouteGeometry", () => {
  it("does not call snap for an all-bushwhack line", async () => {
    const snap = vi.fn(async () => {
      throw new Error("should not snap");
    });
    const result = await composeRouteGeometry(
      [wp("a", 0, 0, "start"), wp("b", 0.01, 0, "end", true)],
      snap,
    );
    expect(snap).not.toHaveBeenCalled();
    expect(result.snapParts).toHaveLength(0);
    expect(result.bushwhackParts).toEqual([[[0, 0], [0.01, 0]]]);
    expect(result.geometry.coordinates).toEqual([[0, 0], [0.01, 0]]);
  });

  it("snaps trail runs in parallel and stitches bushwhack in between", async () => {
    const snap = vi.fn(async (coords: LngLat[]): Promise<LineString> => ({
      type: "LineString",
      coordinates: coords.map(([lng, lat]) => [lng, lat + 0.1]),
    }));
    const result = await composeRouteGeometry(
      [
        wp("a", 0, 0, "start"),
        wp("b", 1, 0, "via"),
        wp("c", 2, 0, "via", true),
        wp("d", 3, 0, "end"),
      ],
      snap,
    );
    expect(snap).toHaveBeenCalledTimes(2);
    expect(result.snapParts).toEqual([
      [[0, 0.1], [1, 0.1]],
      [[2, 0.1], [3, 0.1]],
    ]);
    expect(result.bushwhackParts).toEqual([[[1, 0], [2, 0]]]);
    expect(result.geometry.coordinates[0]).toEqual([0, 0.1]);
    expect(result.geometry.coordinates.at(-1)).toEqual([3, 0.1]);
  });
});
