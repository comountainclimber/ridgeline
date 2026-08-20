import { describe, expect, it } from "vitest";
import { parseGpxServer, toGpx } from "./gpx";

describe("gpx roundtrip", () => {
  it("writes and reads track points", () => {
    const xml = toGpx({
      name: "Test ridge",
      activity: "hike",
      coordinates: [
        [-105.8, 39.63],
        [-105.81, 39.64],
      ],
      elevations: [3500, 3600],
    });
    const parsed = parseGpxServer(xml);
    expect(parsed.name).toBe("Test ridge");
    expect(parsed.geometry.coordinates).toHaveLength(2);
    expect(parsed.geometry.coordinates[0][0]).toBeCloseTo(-105.8, 3);
  });
});
