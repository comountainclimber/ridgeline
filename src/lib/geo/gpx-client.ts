import { gpx as toGeoJSON } from "@tmcw/togeojson";
import type { LineString, LngLat } from "./types";

export function parseGpx(xmlText: string): {
  geometry: LineString;
  name: string | null;
} {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("This file is not valid GPX.");
  }
  const geojson = toGeoJSON(doc);
  const coords: LngLat[] = [];
  let name: string | null = null;

  for (const feature of geojson.features) {
    if (!name && feature.properties && typeof feature.properties.name === "string") {
      name = feature.properties.name;
    }
    const g = feature.geometry;
    if (!g) continue;
    if (g.type === "LineString") {
      for (const c of g.coordinates) coords.push([c[0], c[1]]);
    } else if (g.type === "MultiLineString") {
      for (const line of g.coordinates) {
        for (const c of line) coords.push([c[0], c[1]]);
      }
    }
  }

  if (coords.length < 2) {
    throw new Error("No track or route found in that GPX file.");
  }

  return {
    geometry: { type: "LineString", coordinates: coords },
    name,
  };
}
