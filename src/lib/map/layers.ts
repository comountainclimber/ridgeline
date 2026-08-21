import type { MapStyleId } from "@/lib/geo/types";

export const SOURCE_ROUTE = "ridgeline-route";
export const SOURCE_ORIGINAL = "ridgeline-original";
export const SOURCE_WAYPOINTS = "ridgeline-waypoints";
export const SOURCE_PUCK = "ridgeline-puck";
export const SOURCE_DEM = "mapbox-dem";

export const LAYER_ROUTE_GLOW = "ridgeline-route-glow";
export const LAYER_ROUTE_CORE = "ridgeline-route-core";
export const LAYER_ORIGINAL = "ridgeline-original";
export const LAYER_WAYPOINTS = "ridgeline-waypoints";
export const LAYER_PUCK = "ridgeline-puck";
export const LAYER_SKY = "ridgeline-sky";

export const MAP_STYLES: Record<MapStyleId, { url: string; label: string }> = {
  outdoors: { url: "mapbox://styles/mapbox/outdoors-v12", label: "Outdoors" },
  satellite: { url: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
  winter: { url: "mapbox://styles/mapbox/outdoors-v12", label: "Winter" },
};

export const CHAMONIX: [number, number] = [6.8694, 45.9237];

export const TRACK_COLOR = "#E85D3A";

type WinterMap = {
  getLayer(id: string): unknown;
  setPaintProperty(layer: string, name: string, value: unknown): unknown;
};

const WINTER_LANDCOVER = [
  "match",
  ["get", "class"],
  "wood",
  "hsla(205, 18%, 92%, 0.92)",
  "scrub",
  "hsla(200, 14%, 94%, 0.82)",
  "crop",
  "hsla(40, 12%, 94%, 0.7)",
  "grass",
  "hsla(200, 16%, 95%, 0.78)",
  "snow",
  "hsl(210, 28%, 97%)",
  "hsl(205, 16%, 93%)",
];

const WINTER_LANDUSE = [
  "match",
  ["get", "class"],
  "wood",
  "hsla(205, 18%, 90%, 0.72)",
  "scrub",
  "hsla(200, 14%, 92%, 0.55)",
  "agriculture",
  "hsla(40, 10%, 93%, 0.45)",
  "park",
  "hsl(205, 16%, 91%)",
  "grass",
  "hsla(200, 14%, 93%, 0.5)",
  "glacier",
  "hsl(210, 32%, 96%)",
  "rock",
  "hsl(210, 8%, 82%)",
  "sand",
  "hsl(40, 18%, 90%)",
  "airport",
  "hsl(210, 10%, 88%)",
  "residential",
  "hsl(210, 10%, 92%)",
  "commercial_area",
  "hsl(210, 8%, 90%)",
  "hospital",
  "hsl(210, 12%, 90%)",
  "school",
  "hsl(40, 12%, 90%)",
  "pitch",
  "hsl(205, 12%, 90%)",
  "cemetery",
  "hsl(205, 10%, 90%)",
  ["facility", "industrial"],
  "hsl(210, 8%, 86%)",
  "hsl(205, 12%, 91%)",
];

const WINTER_HILLSHADE = [
  "match",
  ["get", "class"],
  "shadow",
  "hsla(210, 28%, 28%, 0.22)",
  "hsla(0, 0%, 100%, 0.32)",
];

const WINTER_LANDCOVER_OPACITY = ["interpolate", ["linear"], ["zoom"], 6, 0.92, 11, 0.84, 16, 0.42];

/** Recolor Outdoors so the terrain reads as snow, not a grey Dark basemap. */
export function applyWinterBasemap(map: WinterMap) {
  const paint = (id: string, name: string, value: unknown) => {
    if (!map.getLayer(id)) return;
    try {
      map.setPaintProperty(id, name, value);
    } catch {
      // Classic styles omit some layers; ignore paint that does not apply.
    }
  };

  paint("land", "background-color", "hsl(210, 16%, 93%)");
  paint("landcover", "fill-color", WINTER_LANDCOVER);
  paint("landcover", "fill-opacity", WINTER_LANDCOVER_OPACITY);
  paint("national-park", "fill-color", "hsl(205, 18%, 91%)");
  paint("national-park_tint-band", "line-color", "hsla(205, 20%, 80%, 0.45)");
  paint("landuse", "fill-color", WINTER_LANDUSE);
  paint("wetland", "fill-color", "hsl(200, 22%, 86%)");
  paint("water", "fill-color", "hsl(205, 42%, 68%)");
  paint("water-shadow", "fill-color", "hsl(210, 30%, 62%)");
  paint("waterway", "line-color", "hsl(205, 38%, 64%)");
  paint("hillshade", "fill-color", WINTER_HILLSHADE);
  paint("contour-line", "line-color", "hsl(210, 12%, 48%)");
  paint("building", "fill-color", "hsl(210, 8%, 88%)");
  paint("building", "fill-outline-color", "hsl(210, 10%, 72%)");
}
