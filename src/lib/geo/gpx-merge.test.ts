import { describe, expect, it } from "vitest";
import { toGpx } from "./gpx";
import {
  firstPointTimeMs,
  mergeGpxTracks,
  mergedTrackToGpx,
  parseGpxTrack,
  sortTracksByFirstTime,
} from "./gpx-merge";

function sampleGpx(opts: {
  name: string;
  points: { lat: number; lon: number; ele?: number; time?: string }[];
}): string {
  const pts = opts.points
    .map((p) => {
      const ele = p.ele != null ? `<ele>${p.ele}</ele>` : "";
      const time = p.time ? `<time>${p.time}</time>` : "";
      return `<trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}</trkpt>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>${opts.name}</name>
    <trkseg>${pts}</trkseg>
  </trk>
</gpx>`;
}

describe("parseGpxTrack", () => {
  it("keeps elevation and time in document order", () => {
    const xml = sampleGpx({
      name: "Morning",
      points: [
        { lat: 39.63, lon: -105.8, ele: 3500.4, time: "2024-08-20T12:00:00Z" },
        { lat: 39.64, lon: -105.81, ele: 3600.1, time: "2024-08-20T12:05:00Z" },
      ],
    });
    const track = parseGpxTrack(xml);
    expect(track.name).toBe("Morning");
    expect(track.points).toHaveLength(2);
    expect(track.points[0].lng).toBeCloseTo(-105.8, 5);
    expect(track.points[0].ele).toBeCloseTo(3500.4, 5);
    expect(track.points[0].time).toBe("2024-08-20T12:00:00Z");
  });

  it("reads lon-before-lat attributes and rtept", () => {
    const xml = `<gpx><rte><rtept lon="-105.8" lat="39.63"></rtept><rtept lon="-105.81" lat="39.64"/></rte></gpx>`;
    const track = parseGpxTrack(xml);
    expect(track.points).toHaveLength(2);
    expect(track.points[0]).toMatchObject({ lng: -105.8, lat: 39.63 });
  });
});

describe("mergeGpxTracks", () => {
  it("orders files by first timestamp even if uploaded reverse", () => {
    const later = parseGpxTrack(
      sampleGpx({
        name: "Later",
        points: [
          { lat: 1, lon: 1, time: "2024-08-20T13:00:00Z" },
          { lat: 1.1, lon: 1.1, time: "2024-08-20T13:10:00Z" },
        ],
      }),
    );
    const earlier = parseGpxTrack(
      sampleGpx({
        name: "Earlier",
        points: [
          { lat: 0, lon: 0, ele: 10, time: "2024-08-20T12:00:00Z" },
          { lat: 0.1, lon: 0.1, ele: 12, time: "2024-08-20T12:10:00Z" },
        ],
      }),
    );
    const merged = mergeGpxTracks([later, earlier]);
    expect(merged.points.map((p) => p.lat)).toEqual([0, 0.1, 1, 1.1]);
    expect(merged.name).toBe("Earlier");
  });

  it("keeps untimed files after timed ones, in upload order", () => {
    const timed = parseGpxTrack(
      sampleGpx({
        name: "Timed",
        points: [
          { lat: 2, lon: 2, time: "2024-08-20T15:00:00Z" },
          { lat: 2.1, lon: 2.1, time: "2024-08-20T15:01:00Z" },
        ],
      }),
    );
    const untimedA = parseGpxTrack(
      sampleGpx({
        name: "A",
        points: [
          { lat: 3, lon: 3 },
          { lat: 3.1, lon: 3.1 },
        ],
      }),
    );
    const untimedB = parseGpxTrack(
      sampleGpx({
        name: "B",
        points: [
          { lat: 4, lon: 4 },
          { lat: 4.1, lon: 4.1 },
        ],
      }),
    );
    const merged = mergeGpxTracks([untimedA, timed, untimedB]);
    expect(merged.points.map((p) => p.lat)).toEqual([2, 2.1, 3, 3.1, 4, 4.1]);
    expect(sortTracksByFirstTime([untimedA, timed, untimedB], (t) => t).map((t) => t.name)).toEqual([
      "Timed",
      "A",
      "B",
    ]);
  });

  it("writes a single segment and preserves ele and time", () => {
    const a = parseGpxTrack(
      sampleGpx({
        name: "A",
        points: [
          { lat: 39.63, lon: -105.8, ele: 3500, time: "2024-08-20T12:00:00Z" },
          { lat: 39.64, lon: -105.81, ele: 3510, time: "2024-08-20T12:05:00Z" },
        ],
      }),
    );
    const b = parseGpxTrack(
      sampleGpx({
        name: "B",
        points: [
          { lat: 39.65, lon: -105.82, ele: 3520, time: "2024-08-20T13:00:00Z" },
          { lat: 39.66, lon: -105.83, ele: 3530, time: "2024-08-20T13:05:00Z" },
        ],
      }),
    );
    const merged = mergeGpxTracks([b, a]);
    const xml = mergedTrackToGpx(merged, "Full day");
    expect(xml.match(/<trkseg>/g)).toHaveLength(1);
    expect(xml.match(/<trk>/g)).toHaveLength(1);
    expect(xml).toContain("<ele>3500.0</ele>");
    expect(xml).toContain("<time>2024-08-20T12:00:00Z</time>");
    expect(xml).toContain("<time>2024-08-20T13:05:00Z</time>");
    expect(xml).toContain("Merged on Ridgeline");
    const roundtrip = parseGpxTrack(xml);
    expect(roundtrip.points).toHaveLength(4);
    expect(roundtrip.points[0].time).toBe("2024-08-20T12:00:00Z");
    expect(firstPointTimeMs(roundtrip)).toBe(Date.parse("2024-08-20T12:00:00Z"));
  });
});

describe("toGpx optional times", () => {
  it("omits time tags when times are not passed", () => {
    const xml = toGpx({
      name: "Test ridge",
      coordinates: [
        [-105.8, 39.63],
        [-105.81, 39.64],
      ],
      elevations: [3500, 3600],
    });
    expect(xml).not.toContain("<time>");
    expect(xml).toContain("Planned on Ridgeline");
  });
});
