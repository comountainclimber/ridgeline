import { describe, expect, it } from "vitest";
import {
  elevationSampleIndices,
  estimateEta,
  haversine,
  interpolateElevationsAlong,
  lineDistance,
  prepareElevationSamples,
  rejectElevationSpikes,
  smoothElevationSamples,
  statsFromSamples,
} from "./stats";
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

function sample(distanceM: number, elevationM: number, grade = 0): ElevationSample {
  return { distanceM, elevationM, grade, lng: 0, lat: 0 };
}

describe("statsFromSamples deadband", () => {
  it("ignores DEM noise under 10m", () => {
    const samples: ElevationSample[] = [
      sample(0, 100),
      sample(80, 108, 10),
      sample(160, 102, -7),
      sample(240, 130, 35),
    ];
    const stats = statsFromSamples(samples);
    expect(stats.gainM).toBe(30);
    expect(stats.lossM).toBe(0);
  });

  it("does not count leftover climb under the deadband", () => {
    const stats = statsFromSamples([sample(0, 100), sample(80, 110), sample(160, 112)]);
    expect(stats.gainM).toBe(10);
    expect(stats.lossM).toBe(0);
  });

  it("does not count leftover descent under the deadband", () => {
    const stats = statsFromSamples([sample(0, 100), sample(80, 90), sample(160, 88)]);
    expect(stats.gainM).toBe(0);
    expect(stats.lossM).toBe(10);
  });

  it("does not turn a sub-threshold drift into vert", () => {
    const stats = statsFromSamples(
      [sample(0, 100), sample(80, 104), sample(160, 108)],
    );
    expect(stats.gainM).toBe(0);
    expect(stats.lossM).toBe(0);
  });

  it("commits gain once a gradual climb crosses the deadband", () => {
    const stats = statsFromSamples(
      [sample(0, 100), sample(80, 104), sample(160, 108), sample(240, 112)],
    );
    expect(stats.gainM).toBe(12);
    expect(stats.lossM).toBe(0);
  });

  it("does not turn oscillating DEM noise into vert", () => {
    const stats = statsFromSamples(
      [sample(0, 100), sample(80, 108), sample(160, 100), sample(240, 108), sample(320, 100)],
    );
    expect(stats.gainM).toBe(0);
    expect(stats.lossM).toBe(0);
  });
});

describe("elevation sampling", () => {
  it("always includes the first and last index", () => {
    const idx = elevationSampleIndices(37, 10);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(36);
    expect(idx).toHaveLength(10);
  });

  it("interpolates sparse DEM samples onto every vertex", () => {
    const out = interpolateElevationsAlong(5, [0, 2, 4], [100, 200, 100]);
    expect(out[0]).toBe(100);
    expect(out[1]).toBe(150);
    expect(out[2]).toBe(200);
    expect(out[3]).toBe(150);
    expect(out[4]).toBe(100);
  });
});

describe("elevation cleanup", () => {
  it("drops a one-sample summit spike so high is not thousands of feet off", () => {
    const cleaned = rejectElevationSpikes([
      sample(0, 3000),
      sample(80, 4200),
      sample(160, 3010),
    ]);
    expect(cleaned[1].elevationM).toBeCloseTo(3005, 0);
    const stats = statsFromSamples(cleaned);
    expect(stats.highM).toBeLessThan(3100);
  });

  it("keeps a real monotonic climb", () => {
    const cleaned = rejectElevationSpikes([
      sample(0, 3000),
      sample(80, 3040),
      sample(160, 3080),
    ]);
    expect(cleaned[2].elevationM).toBe(3080);
  });

  it("smooths cell stair-steps so they do not sum as extra vert", () => {
    const jagged = [
      sample(0, 100),
      sample(80, 118),
      sample(160, 102),
      sample(240, 119),
      sample(320, 101),
    ];
    const stats = statsFromSamples(smoothElevationSamples(jagged));
    expect(stats.gainM).toBeLessThan(20);
  });

  it("prepareElevationSamples matches stats to cleaned DEM, not raw spikes", () => {
    const points: [number, number][] = [
      [0, 0],
      [0.001, 0],
      [0.002, 0],
      [0.003, 0],
      [0.004, 0],
    ];
    const samples = prepareElevationSamples(points, [3000, 4200, 3010, 3020, 3030]);
    const stats = statsFromSamples(samples);
    expect(stats.highM).toBeLessThan(3200);
    expect(stats.gainM).toBeLessThan(80);
  });
});

describe("estimateEta", () => {
  it("adds vert time for hiking", () => {
    const flat = estimateEta(5000, 0);
    const steep = estimateEta(5000, 609.6);
    expect(steep).toBeGreaterThan(flat + 3000);
  });
});
