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
  winter: { url: "mapbox://styles/mapbox/dark-v11", label: "Winter" },
};

export const CHAMONIX: [number, number] = [6.8694, 45.9237];
