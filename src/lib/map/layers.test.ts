import { describe, expect, it, vi } from "vitest";
import {
  CRESTED_BUTTE,
  CRESTED_BUTTE_BEARING,
  CRESTED_BUTTE_PITCH,
  CRESTED_BUTTE_ZOOM,
  MAP_STYLES,
  applyWinterBasemap,
} from "./layers";

describe("CRESTED_BUTTE", () => {
  it("looks up at Mt. Crested Butte from the valley floor", () => {
    expect(CRESTED_BUTTE[0]).toBeCloseTo(-106.97, 1);
    expect(CRESTED_BUTTE[1]).toBeCloseTo(38.88, 1);
    expect(CRESTED_BUTTE_ZOOM).toBeGreaterThan(14);
    expect(CRESTED_BUTTE_PITCH).toBeGreaterThan(70);
    expect(CRESTED_BUTTE_BEARING).toBeGreaterThan(40);
  });
});

describe("MAP_STYLES", () => {
  it("keeps winter on outdoors cartography instead of the dark grey basemap", () => {
    expect(MAP_STYLES.winter.url).toBe(MAP_STYLES.outdoors.url);
    expect(MAP_STYLES.winter.url).not.toContain("dark-");
  });
});

describe("applyWinterBasemap", () => {
  it("recolors land and landcover when those layers exist", () => {
    const setPaintProperty = vi.fn();
    applyWinterBasemap({
      getLayer: (id) => (id === "land" || id === "landcover" ? {} : undefined),
      setPaintProperty,
    });
    expect(setPaintProperty).toHaveBeenCalledWith("land", "background-color", "hsl(210, 16%, 93%)");
    expect(setPaintProperty).toHaveBeenCalledWith("landcover", "fill-color", expect.any(Array));
    expect(setPaintProperty).not.toHaveBeenCalledWith("water", expect.anything(), expect.anything());
  });
});
