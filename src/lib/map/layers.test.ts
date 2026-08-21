import { describe, expect, it, vi } from "vitest";
import { MAP_STYLES, applyWinterBasemap } from "./layers";

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
