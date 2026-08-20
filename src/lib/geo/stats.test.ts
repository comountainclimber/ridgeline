import { describe, expect, it } from "vitest";
import { estimateEta, haversine, lineDistance, statsFromSamples } from "./stats";
import type { ElevationSample } from "./types";

describe("haversine", () => {
  it("measures a known short distance", () => {
    const d = haversine([-105.8172, 39.6336], [-105.8172, 39.6436]);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });
});

describe("lineDistance", () => {
  it("sums segments", () => {
    const d = lineDistance([
      [0, 0],
      [0, 0],
      [0.01, 0],
    ]);
    expect(d).toBeGreaterThan(1000);
  });
});

describe("statsFromSamples deadband", () => {
  it("ignores DEM noise under 3m", () => {
    const samples: ElevationSample[] = [
      { distanceM: 0, elevationM: 100, grade: 0, lng: 0, lat: 0 },
      { distanceM: 30, elevationM: 102, grade: 6, lng: 0, lat: 0 },
      { distanceM: 60, elevationM: 101, grade: -3, lng: 0, lat: 0 },
      { distanceM: 90, elevationM: 130, grade: 30, lng: 0, lat: 0 },
    ];
    const stats = statsFromSamples(samples, "hike");
    expect(stats.gainM).toBeGreaterThanOrEqual(28);
    expect(stats.gainM).toBeLessThan(40);
  });
});

describe("estimateEta", () => {
  it("adds vert time for hiking", () => {
    const flat = estimateEta("hike", 5000, 0);
    const steep = estimateEta("hike", 5000, 609.6);
    expect(steep).toBeGreaterThan(flat + 3000);
  });
});
