"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LineString, LngLat, MapStyleId, Waypoint } from "@/lib/geo/types";
import { bboxOf } from "@/lib/geo/stats";
import {
  CRESTED_BUTTE,
  CRESTED_BUTTE_BEARING,
  CRESTED_BUTTE_PITCH,
  CRESTED_BUTTE_ZOOM,
  LAYER_BUSHWHACK,
  LAYER_ORIGINAL,
  LAYER_PUCK,
  LAYER_ROUTE_CORE,
  LAYER_ROUTE_GLOW,
  LAYER_SKY,
  MAP_STYLES,
  SOURCE_BUSHWHACK,
  SOURCE_DEM,
  SOURCE_ORIGINAL,
  SOURCE_PUCK,
  SOURCE_ROUTE,
  TRACK_COLOR,
  applyWinterBasemap,
} from "@/lib/map/layers";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  styleId: MapStyleId;
  pitched: boolean;
  geometry: LineString | null;
  originalGeometry: LineString | null;
  showOriginal: boolean;
  /** Snapped trail runs only. When omitted, `geometry` is drawn solid. */
  trailParts?: LngLat[][] | null;
  bushwhackParts?: LngLat[][] | null;
  waypoints: Waypoint[];
  puck: LngLat | null;
  userLocation?: LngLat | null;
  interactive?: boolean;
  onClickLngLat?: (lng: number, lat: number) => void;
  onWaypointMove?: (id: string, lng: number, lat: number) => void;
  onReady?: (map: mapboxgl.Map) => void;
  className?: string;
  initialCenter?: LngLat;
  initialZoom?: number;
  initialBearing?: number;
  initialPitch?: number;
  /** Frame the camera on the route instead of the default mountain. */
  fitToTrack?: boolean;
};

export function MapCanvas({
  styleId,
  pitched,
  geometry,
  originalGeometry,
  showOriginal,
  trailParts = null,
  bushwhackParts = null,
  waypoints,
  puck,
  userLocation = null,
  interactive = true,
  onClickLngLat,
  onWaypointMove,
  onReady,
  className,
  initialCenter,
  initialZoom = CRESTED_BUTTE_ZOOM,
  initialBearing = CRESTED_BUTTE_BEARING,
  initialPitch = CRESTED_BUTTE_PITCH,
  fitToTrack = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const clickRef = useRef(onClickLngLat);
  const moveRef = useRef(onWaypointMove);
  const geometryRef = useRef(geometry);
  const originalRef = useRef(originalGeometry);
  const trailPartsRef = useRef(trailParts);
  const bushwhackPartsRef = useRef(bushwhackParts);
  const pitchedRef = useRef(pitched);
  const userLocationRef = useRef(userLocation);
  const styleEpochRef = useRef(0);
  const skipInitialStyleRef = useRef(true);
  const lastStyleIdRef = useRef(styleId);
  const fitToTrackRef = useRef(fitToTrack);

  useEffect(() => {
    clickRef.current = onClickLngLat;
    moveRef.current = onWaypointMove;
    geometryRef.current = geometry;
    originalRef.current = originalGeometry;
    trailPartsRef.current = trailParts;
    bushwhackPartsRef.current = bushwhackParts;
    pitchedRef.current = pitched;
    userLocationRef.current = userLocation;
    fitToTrackRef.current = fitToTrack;
  });

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[styleId].url,
      center: initialCenter ?? centerFromGeometry(geometry) ?? CRESTED_BUTTE,
      zoom: initialZoom,
      pitch: pitched ? initialPitch : 0,
      bearing: pitched ? initialBearing : 0,
      maxPitch: 85,
      antialias: true,
      attributionControl: true,
      cooperativeGestures: false,
    });
    mapRef.current = map;
    if (!pitched) {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
    } else {
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
    }

    const onLoad = () => {
      const shouldFit = fitToTrackRef.current;
      finishStyle(map, styleId, pitchedRef.current, { animate: !shouldFit });
      setRouteData(map, geometryRef.current, trailPartsRef.current);
      setLineData(map, SOURCE_ORIGINAL, originalRef.current);
      setMultiLineData(map, SOURCE_BUSHWHACK, bushwhackPartsRef.current);
      applyUserMarker(map, userMarkerRef, userLocationRef.current);
      if (shouldFit) fitTrack(map, geometryRef.current, { pitched: pitchedRef.current, duration: 0 });
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
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
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
    if (!map?.isStyleLoaded()) return;
    applyDimension(map, styleId, pitched);
  }, [pitched, styleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = lastStyleIdRef.current;
    lastStyleIdRef.current = styleId;
    if (skipInitialStyleRef.current) {
      skipInitialStyleRef.current = false;
      return;
    }

    const restoreOverlays = () => {
      finishStyle(map, styleId, pitchedRef.current, { animate: false });
      setRouteData(map, geometryRef.current, trailPartsRef.current);
      setLineData(map, SOURCE_ORIGINAL, originalRef.current);
      setMultiLineData(map, SOURCE_BUSHWHACK, bushwhackPartsRef.current);
      if (fitToTrackRef.current) {
        fitTrack(map, geometryRef.current, { pitched: pitchedRef.current, duration: 0 });
      }
    };

    if (
      styleId === "winter" &&
      MAP_STYLES[prev].url === MAP_STYLES.winter.url &&
      map.isStyleLoaded()
    ) {
      restoreOverlays();
      return;
    }

    const epoch = ++styleEpochRef.current;
    map.setStyle(MAP_STYLES[styleId].url, { diff: false } as Parameters<mapboxgl.Map["setStyle"]>[1]);
    map.once("style.load", () => {
      if (epoch !== styleEpochRef.current) return;
      restoreOverlays();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      applyUserMarker(map, userMarkerRef, userLocationRef.current);
    });
  }, [styleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    ensureLayers(map);
    setRouteData(map, geometry, trailParts);
    setLineData(map, SOURCE_ORIGINAL, originalGeometry);
    setMultiLineData(map, SOURCE_BUSHWHACK, bushwhackParts);
    map.setLayoutProperty(LAYER_ORIGINAL, "visibility", showOriginal ? "visible" : "none");
  }, [geometry, originalGeometry, showOriginal, trailParts, bushwhackParts, pitched]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !fitToTrack) return;
    fitTrack(map, geometry, { pitched, duration: 0 });
  }, [geometry, fitToTrack, pitched]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = waypoints.map((wp, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "ridgeline-marker";
      const offTrail = Boolean(wp.bushwhack) && wp.kind !== "start";
      el.style.cssText = markerStyle(wp.kind, TRACK_COLOR, offTrail);
      el.textContent = wp.kind === "start" ? "" : wp.kind === "end" ? "▲" : String(i);
      el.setAttribute(
        "aria-label",
        offTrail ? `${wp.label ?? wp.kind}, off trail` : (wp.label ?? wp.kind),
      );
      const marker = new mapboxgl.Marker({ element: el, draggable: Boolean(moveRef.current) })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        moveRef.current?.(wp.id, lngLat.lng, lngLat.lat);
      });
      return marker;
    });
  }, [waypoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    ensureLayers(map);
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
  }, [puck]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyUserMarker(map, userMarkerRef, userLocation);
  }, [userLocation]);

  if (!TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07080A] text-[#C9D6E3]">
        Add a Mapbox token to see the mountain.
      </div>
    );
  }

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

function finishStyle(
  map: mapboxgl.Map,
  styleId: MapStyleId,
  threeD: boolean,
  opts?: { animate?: boolean },
) {
  if (styleId === "winter") applyWinterBasemap(map);
  applyDimension(map, styleId, threeD, opts);
  ensureLayers(map);
}

function applyDimension(
  map: mapboxgl.Map,
  styleId: MapStyleId,
  threeD: boolean,
  opts?: { animate?: boolean },
) {
  const duration = opts?.animate === false ? 0 : 900;
  try {
    if (threeD) {
      enableTerrain(map, styleId);
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.easeTo({
        pitch: map.getPitch() || CRESTED_BUTTE_PITCH,
        bearing: map.getBearing() || CRESTED_BUTTE_BEARING,
        duration,
      });
      return;
    }

    map.setTerrain(null);
    map.setFog(null);
    if (map.getLayer(LAYER_SKY)) {
      map.removeLayer(LAYER_SKY);
    }
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.easeTo({ pitch: 0, bearing: 0, duration });
  } catch {
    map.easeTo({
      pitch: threeD ? map.getPitch() || CRESTED_BUTTE_PITCH : 0,
      bearing: threeD ? map.getBearing() : 0,
      duration,
    });
  }
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
  const winter = styleId === "winter";
  map.setFog({
    color: winter ? "rgb(226, 234, 242)" : "rgb(186, 210, 235)",
    "high-color": winter ? "rgb(170, 198, 226)" : "rgb(36, 92, 223)",
    "horizon-blend": winter ? 0.08 : 0.06,
    "space-color": winter ? "#9BB8D3" : "#07080A",
    "star-intensity": winter ? 0 : 0.15,
  });
  if (map.getLayer(LAYER_SKY)) {
    map.removeLayer(LAYER_SKY);
  }
  const before =
    (map.getLayer(LAYER_ORIGINAL) && LAYER_ORIGINAL) ||
    (map.getLayer(LAYER_ROUTE_GLOW) && LAYER_ROUTE_GLOW) ||
    undefined;
  map.addLayer(
    {
      id: LAYER_SKY,
      type: "sky",
      paint: winter
        ? {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0, 75],
            "sky-atmosphere-sun-intensity": 16,
            "sky-atmosphere-color": "rgb(186, 210, 235)",
            "sky-atmosphere-halo-color": "rgb(255, 255, 255)",
          }
        : {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 5,
          },
    },
    before,
  );
}

function emptyLine(): GeoJSON.Feature {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function emptyMultiLine(): GeoJSON.Feature {
  return { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: [] } };
}

function emptyPoints(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function ensureLayers(map: mapboxgl.Map) {
  if (!map.getSource(SOURCE_ROUTE)) {
    map.addSource(SOURCE_ROUTE, { type: "geojson", data: emptyLine() });
  }
  if (!map.getSource(SOURCE_ORIGINAL)) {
    map.addSource(SOURCE_ORIGINAL, { type: "geojson", data: emptyLine() });
  }
  if (!map.getSource(SOURCE_BUSHWHACK)) {
    map.addSource(SOURCE_BUSHWHACK, { type: "geojson", data: emptyMultiLine() });
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
        "line-color": TRACK_COLOR,
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
        "line-color": TRACK_COLOR,
        "line-width": 4,
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer(LAYER_BUSHWHACK)) {
    map.addLayer({
      id: LAYER_BUSHWHACK,
      type: "line",
      source: SOURCE_BUSHWHACK,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": TRACK_COLOR,
        "line-width": 4,
        "line-opacity": 0.95,
        "line-dasharray": [1.6, 1.4],
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
        "circle-stroke-color": TRACK_COLOR,
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

function setMultiLineData(map: mapboxgl.Map, sourceId: string, parts: LngLat[][] | null) {
  const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  source?.setData({
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: (parts ?? []).filter((part) => part.length >= 2),
    },
  });
}

function setRouteData(
  map: mapboxgl.Map,
  geometry: LineString | null,
  trailParts: LngLat[][] | null,
) {
  if (trailParts != null) {
    setMultiLineData(map, SOURCE_ROUTE, trailParts);
    return;
  }
  setLineData(map, SOURCE_ROUTE, geometry);
}

function markerStyle(kind: Waypoint["kind"], color: string, offTrail = false) {
  const size = kind === "via" ? 22 : 26;
  return [
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:999px",
    `background:${kind === "end" ? color : "#07080A"}`,
    `border:2px ${offTrail ? "dashed" : "solid"} ${color}`,
    "color:#F4F1EA",
    "font-size:10px",
    "font-weight:600",
    "display:grid",
    "place-items:center",
    "cursor:pointer",
    "box-shadow:0 6px 16px rgba(0,0,0,.45)",
  ].join(";");
}

function makeUserPinEl() {
  const el = document.createElement("div");
  el.className = "ridgeline-user-pin";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Your location");
  const pulse = document.createElement("span");
  pulse.className = "ridgeline-user-pin-pulse";
  const dot = document.createElement("span");
  dot.className = "ridgeline-user-pin-dot";
  el.append(pulse, dot);
  return el;
}

function applyUserMarker(
  map: mapboxgl.Map,
  markerRef: { current: mapboxgl.Marker | null },
  location: LngLat | null,
) {
  if (!location) {
    markerRef.current?.remove();
    markerRef.current = null;
    return;
  }
  if (markerRef.current) {
    markerRef.current.setLngLat(location);
    return;
  }
  markerRef.current = new mapboxgl.Marker({
    element: makeUserPinEl(),
    anchor: "center",
  })
    .setLngLat(location)
    .addTo(map);
}

function centerFromGeometry(geometry: LineString | null): LngLat | undefined {
  if (!geometry?.coordinates.length) return undefined;
  const box = bboxOf(geometry.coordinates);
  if (!box) return geometry.coordinates[0];
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

export function fitTrack(
  map: mapboxgl.Map,
  geometry: LineString | null,
  opts?: { pitched?: boolean; duration?: number },
) {
  if (!geometry || geometry.coordinates.length < 2) return;
  const bounds = new mapboxgl.LngLatBounds();
  for (const coord of geometry.coordinates) {
    bounds.extend(coord as [number, number]);
  }
  const pitched = opts?.pitched ?? true;
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.fitBounds(bounds, {
    padding: { top: 96, bottom: 240, left: 40, right: 40 },
    duration: reduce ? 0 : (opts?.duration ?? 0),
    maxZoom: 14.2,
    pitch: pitched ? 62 : 0,
    bearing: pitched ? -18 : 0,
    essential: true,
  });
}
