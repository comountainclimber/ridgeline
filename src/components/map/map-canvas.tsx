"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LineString, LngLat, MapStyleId, Waypoint } from "@/lib/geo/types";
import { ACTIVITY_META, type Activity } from "@/lib/geo/types";
import {
  LAYER_ORIGINAL,
  LAYER_PUCK,
  LAYER_ROUTE_CORE,
  LAYER_ROUTE_GLOW,
  LAYER_SKY,
  MAP_STYLES,
  SOURCE_DEM,
  SOURCE_ORIGINAL,
  SOURCE_PUCK,
  SOURCE_ROUTE,
} from "@/lib/map/layers";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  activity: Activity;
  styleId: MapStyleId;
  pitched: boolean;
  geometry: LineString | null;
  originalGeometry: LineString | null;
  showOriginal: boolean;
  waypoints: Waypoint[];
  puck: LngLat | null;
  interactive?: boolean;
  onClickLngLat?: (lng: number, lat: number) => void;
  onWaypointMove?: (id: string, lng: number, lat: number) => void;
  onReady?: (map: mapboxgl.Map) => void;
  className?: string;
  initialCenter?: LngLat;
  initialZoom?: number;
};

export function MapCanvas({
  activity,
  styleId,
  pitched,
  geometry,
  originalGeometry,
  showOriginal,
  waypoints,
  puck,
  interactive = true,
  onClickLngLat,
  onWaypointMove,
  onReady,
  className,
  initialCenter = [6.8694, 45.9237],
  initialZoom = 11.4,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const clickRef = useRef(onClickLngLat);
  const moveRef = useRef(onWaypointMove);
  const geometryRef = useRef(geometry);
  const originalRef = useRef(originalGeometry);
  clickRef.current = onClickLngLat;
  moveRef.current = onWaypointMove;
  geometryRef.current = geometry;
  originalRef.current = originalGeometry;

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[styleId].url,
      center: initialCenter,
      zoom: initialZoom,
      pitch: pitched ? 62 : 0,
      bearing: -18,
      antialias: true,
      attributionControl: true,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    const onLoad = () => {
      enableTerrain(map, styleId);
      ensureLayers(map, activity);
      onReady?.(map);
    };
    map.on("load", onLoad);
    map.on("click", (e) => {
      if (!interactive) return;
      clickRef.current?.(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = interactive ? "crosshair" : "grab";
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setPitch(pitched ? 62 : 0, { duration: 900 });
  }, [pitched]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAP_STYLES[styleId].url);
    map.once("style.load", () => {
      enableTerrain(map, styleId);
      ensureLayers(map, activity);
      setLineData(map, SOURCE_ROUTE, geometryRef.current);
      setLineData(map, SOURCE_ORIGINAL, originalRef.current);
      paintRoute(map, activity);
    });
  }, [styleId, activity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    ensureLayers(map, activity);
    setLineData(map, SOURCE_ROUTE, geometry);
    setLineData(map, SOURCE_ORIGINAL, originalGeometry);
    map.setLayoutProperty(LAYER_ORIGINAL, "visibility", showOriginal ? "visible" : "none");
    paintRoute(map, activity);
  }, [geometry, originalGeometry, showOriginal, activity, pitched]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = waypoints.map((wp, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "ridgeline-marker";
      el.style.cssText = markerStyle(wp.kind, ACTIVITY_META[activity].color);
      el.textContent = wp.kind === "start" ? "" : wp.kind === "end" ? "▲" : String(i);
      el.setAttribute("aria-label", wp.label ?? wp.kind);
      const marker = new mapboxgl.Marker({ element: el, draggable: Boolean(moveRef.current) })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        moveRef.current?.(wp.id, lngLat.lng, lngLat.lat);
      });
      return marker;
    });
  }, [waypoints, activity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    ensureLayers(map, activity);
    const source = map.getSource(SOURCE_PUCK) as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: puck
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: puck },
            },
          ]
        : [],
    });
  }, [puck, activity]);

  if (!TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07080A] text-[#C9D6E3]">
        Add a Mapbox token to see the mountain.
      </div>
    );
  }

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

function enableTerrain(map: mapboxgl.Map, styleId: MapStyleId) {
  if (!map.getSource(SOURCE_DEM)) {
    map.addSource(SOURCE_DEM, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: SOURCE_DEM, exaggeration: styleId === "satellite" ? 1.15 : 1.35 });
  map.setFog({
    color: styleId === "winter" ? "rgb(40, 52, 68)" : "rgb(186, 210, 235)",
    "high-color": styleId === "winter" ? "rgb(18, 28, 42)" : "rgb(36, 92, 223)",
    "horizon-blend": 0.06,
    "space-color": "#07080A",
    "star-intensity": styleId === "winter" ? 0.4 : 0.15,
  });
  if (!map.getLayer(LAYER_SKY)) {
    map.addLayer({
      id: LAYER_SKY,
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 0.0],
        "sky-atmosphere-sun-intensity": 5,
      },
    });
  }
}

function emptyLine(): GeoJSON.Feature {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function emptyPoints(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function ensureLayers(map: mapboxgl.Map, activity: Activity) {
  if (!map.getSource(SOURCE_ROUTE)) {
    map.addSource(SOURCE_ROUTE, { type: "geojson", data: emptyLine() });
  }
  if (!map.getSource(SOURCE_ORIGINAL)) {
    map.addSource(SOURCE_ORIGINAL, { type: "geojson", data: emptyLine() });
  }
  if (!map.getSource(SOURCE_PUCK)) {
    map.addSource(SOURCE_PUCK, { type: "geojson", data: emptyPoints() });
  }
  if (!map.getLayer(LAYER_ORIGINAL)) {
    map.addLayer({
      id: LAYER_ORIGINAL,
      type: "line",
      source: SOURCE_ORIGINAL,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#C9D6E3",
        "line-opacity": 0.35,
        "line-width": 3,
        "line-dasharray": [1.4, 1.6],
      },
    });
  }
  if (!map.getLayer(LAYER_ROUTE_GLOW)) {
    map.addLayer({
      id: LAYER_ROUTE_GLOW,
      type: "line",
      source: SOURCE_ROUTE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ACTIVITY_META[activity].color,
        "line-width": 12,
        "line-opacity": 0.28,
        "line-blur": 2,
      },
    });
  }
  if (!map.getLayer(LAYER_ROUTE_CORE)) {
    map.addLayer({
      id: LAYER_ROUTE_CORE,
      type: "line",
      source: SOURCE_ROUTE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ACTIVITY_META[activity].color,
        "line-width": 4,
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer(LAYER_PUCK)) {
    map.addLayer({
      id: LAYER_PUCK,
      type: "circle",
      source: SOURCE_PUCK,
      paint: {
        "circle-radius": 7,
        "circle-color": "#F4F1EA",
        "circle-stroke-width": 3,
        "circle-stroke-color": ACTIVITY_META[activity].color,
      },
    });
  }
}

function setLineData(map: mapboxgl.Map, sourceId: string, geometry: LineString | null) {
  const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  source?.setData({
    type: "Feature",
    properties: {},
    geometry: geometry ?? { type: "LineString", coordinates: [] },
  });
}

function paintRoute(map: mapboxgl.Map, activity: Activity) {
  const color = ACTIVITY_META[activity].color;
  if (map.getLayer(LAYER_ROUTE_GLOW)) {
    map.setPaintProperty(LAYER_ROUTE_GLOW, "line-color", color);
  }
  if (map.getLayer(LAYER_ROUTE_CORE)) {
    map.setPaintProperty(LAYER_ROUTE_CORE, "line-color", color);
  }
  if (map.getLayer(LAYER_PUCK)) {
    map.setPaintProperty(LAYER_PUCK, "circle-stroke-color", color);
  }
}

function markerStyle(kind: Waypoint["kind"], color: string) {
  const size = kind === "via" ? 22 : 26;
  return [
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:999px",
    `background:${kind === "end" ? color : "#07080A"}`,
    `border:2px solid ${color}`,
    "color:#F4F1EA",
    "font-size:10px",
    "font-weight:600",
    "display:grid",
    "place-items:center",
    "cursor:pointer",
    "box-shadow:0 6px 16px rgba(0,0,0,.45)",
  ].join(";");
}

export async function flyTheLine(map: mapboxgl.Map, geometry: LineString) {
  if (geometry.coordinates.length < 2) return;
  const start = geometry.coordinates[0] as [number, number];
  const mid = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)] as [number, number];
  map.flyTo({ center: start, zoom: 12.5, pitch: 68, bearing: 20, duration: 1400 });
  await new Promise((r) => setTimeout(r, 1500));
  map.flyTo({ center: mid, zoom: 13.2, pitch: 64, duration: 1800 });
}
