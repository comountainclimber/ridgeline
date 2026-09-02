"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  LocateFixed,
  Save,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { MapCanvas, fitTrack } from "@/components/map/map-canvas";
import { ElevationProfile } from "@/components/planner/elevation-profile";
import {
  DimensionToggle,
  DrawModeToggle,
  StyleToggle,
} from "@/components/planner/map-toggles";
import { PlaceSearch } from "@/components/planner/place-search";
import {
  PlannerMobileHeader,
  PlannerMobileHud,
  WaypointPanel,
  type MobilePanel,
} from "@/components/planner/planner-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseGpx } from "@/lib/geo/gpx-client";
import { toGpx } from "@/lib/geo/gpx";
import { clearGpxImport, readGpxImport } from "@/lib/geo/gpx-merge";
import { formatDistance, formatElevation, formatVert } from "@/lib/geo/format";
import {
  ELEVATION_SAMPLE_M,
  densify,
  lineDistance,
  pointAlong,
  prepareElevationSamples,
  statsFromSamples,
} from "@/lib/geo/stats";
import { makeWaypoint, relabelWaypoints } from "@/lib/geo/helpers";
import {
  composeRouteGeometry,
  reverseWaypointsPreservingLegs,
  splitRouteRuns,
} from "@/lib/geo/compose";
import {
  canRotateLoopJoin,
  isClosedLoop,
  nearestPointOnLine,
  rotateClosedLineTo,
  rotateElevationSamples,
  rotateLoopWaypoints,
} from "@/lib/geo/loop";
import {
  type DrawMode,
  type ElevationSample,
  type LineString,
  type LngLat,
  type MapStyleId,
  type SavedRoute,
  type Units,
  type Waypoint,
} from "@/lib/geo/types";

const DRAFT_KEY = "ridgeline-draft";

type History = {
  waypoints: Waypoint[];
  geometry: LineString | null;
  originalGeometry: LineString | null;
  snapParts: LngLat[][];
  bushwhackParts: LngLat[][];
  samples: ElevationSample[];
};

async function snapAlongTrails(coords: LngLat[]): Promise<LineString> {
  const res = await fetch("/api/map/directions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      waypoints: coords.map(([lng, lat]) => ({ lng, lat })),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not snap that line.");
  return json.geometry as LineString;
}

export function PlannerApp({
  fork,
}: {
  fork?: {
    name: string;
    waypoints: Waypoint[];
    geometry: LineString | null;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [styleId, setStyleId] = useState<MapStyleId>("outdoors");
  const [pitched, setPitched] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("ridgeline-dimension") !== "2d";
  });
  const [waypoints, setWaypoints] = useState<Waypoint[]>(fork?.waypoints ?? []);
  const [geometry, setGeometry] = useState<LineString | null>(fork?.geometry ?? null);
  const [originalGeometry, setOriginalGeometry] = useState<LineString | null>(null);
  const [snapParts, setSnapParts] = useState<LngLat[][]>(
    fork?.geometry ? [fork.geometry.coordinates] : [],
  );
  const [bushwhackParts, setBushwhackParts] = useState<LngLat[][]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>("trail");
  const [showOriginal, setShowOriginal] = useState(false);
  const [samples, setSamples] = useState<ElevationSample[]>([]);
  const [hoverM, setHoverM] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(fork?.name ?? "Untitled line");
  const [units, setUnits] = useState<Units>("imperial");
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [userLocation, setUserLocation] = useState<LngLat | null>(null);
  const [locating, setLocating] = useState(false);
  const history = useRef<History[]>([]);
  const future = useRef<History[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const mapHolder = useRef<import("mapbox-gl").Map | null>(null);
  const pendingFly = useRef<LngLat | null>(null);
  const pendingFit = useRef<LineString | null>(null);
  const watchId = useRef<number | null>(null);
  const didAutoLocate = useRef(false);
  const elevationSeq = useRef(0);
  const importGeometryRef = useRef<(trackName: string, original: LineString) => Promise<void>>(
    async () => undefined,
  );

  const stats = useMemo(() => statsFromSamples(samples), [samples]);
  const puck = hoverM != null && geometry ? pointAlong(geometry.coordinates, hoverM) : null;
  const loopJoin = useMemo(
    () => canRotateLoopJoin(geometry, bushwhackParts),
    [bushwhackParts, geometry],
  );

  const pushHistory = useCallback((next: History) => {
    history.current.push({
      waypoints,
      geometry,
      originalGeometry,
      snapParts,
      bushwhackParts,
      samples,
    });
    future.current = [];
    if (history.current.length > 40) history.current.shift();
    setWaypoints(next.waypoints);
    setGeometry(next.geometry);
    setOriginalGeometry(next.originalGeometry);
    setSnapParts(next.snapParts);
    setBushwhackParts(next.bushwhackParts);
    setSamples(next.samples);
  }, [bushwhackParts, geometry, originalGeometry, samples, snapParts, waypoints]);

  const routeWaypoints = useCallback(
    async (pts: Waypoint[], original?: LineString | null) => {
      if (pts.length < 2) {
        elevationSeq.current += 1;
        setGeometry(null);
        setSamples([]);
        setSnapParts([]);
        setBushwhackParts([]);
        return;
      }
      const needsSnap = splitRouteRuns(pts).some((run) => !run.bushwhack);
      setRouting(needsSnap);
      setError(null);
      try {
        const composed = await composeRouteGeometry(pts, snapAlongTrails);
        setGeometry(composed.geometry);
        setSnapParts(composed.snapParts);
        setBushwhackParts(composed.bushwhackParts);
        if (original !== undefined) setOriginalGeometry(original);
        await sampleElevations(composed.geometry);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Routing failed");
      } finally {
        setRouting(false);
      }
    },
    [],
  );

  async function sampleElevations(geo: LineString) {
    const seq = ++elevationSeq.current;
    const dense = densify(geo.coordinates, ELEVATION_SAMPLE_M);
    const res = await fetch("/api/map/elevation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: dense }),
    });
    const json = await res.json().catch(() => ({}));
    if (seq !== elevationSeq.current) return;
    const elevations = (json.elevations ?? []) as (number | null)[];
    setSamples(prepareElevationSamples(dense, elevations));
  }

  const pinAndFly = useCallback((lng: number, lat: number) => {
    const next: LngLat = [lng, lat];
    setUserLocation(next);
    const map = mapHolder.current;
    if (!map) {
      pendingFly.current = next;
      return;
    }
    flyMapTo(map, next);
  }, []);

  const locate = useCallback((opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!navigator.geolocation) {
      if (!silent) toast.error("Location isn’t available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pinAndFly(pos.coords.longitude, pos.coords.latitude);
        if (watchId.current == null) {
          watchId.current = navigator.geolocation.watchPosition(
            (next) => {
              setUserLocation([next.coords.longitude, next.coords.latitude]);
            },
            () => undefined,
            { enableHighAccuracy: true, maximumAge: 4000 },
          );
        }
      },
      (err) => {
        setLocating(false);
        if (silent) return;
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Location permission is off — enable it to pin yourself on the map.");
          return;
        }
        if (err.code === err.TIMEOUT) {
          toast.error("Couldn’t fix your position. Try again with a clearer view of the sky.");
          return;
        }
        toast.error("Couldn’t find your location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 8000 },
    );
  }, [pinAndFly]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => {
        if (j.user?.displayName) setUserName(j.user.displayName);
        if (j.user?.email) setUserEmail(j.user.email);
        if (j.user?.units) setUnits(j.user.units);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const forkId = searchParams.get("fork");
    if (!forkId) return;
    void fetch(`/api/routes/${forkId}`)
      .then((r) => r.json())
      .then((j) => {
        const route = j.route as SavedRoute | undefined;
        if (!route) return;
        setName(`${route.name} (copy)`);
        setWaypoints(route.waypoints);
        setGeometry(route.geometry);
        setSnapParts(route.geometry ? [route.geometry.coordinates] : []);
        setBushwhackParts([]);
        if (route.geometry) {
          const map = mapHolder.current;
          if (map) fitTrack(map, route.geometry, { pitched });
          else pendingFit.current = route.geometry;
          void sampleElevations(route.geometry);
        }
      });
  }, [searchParams]);

  useEffect(() => {
    if (fork || searchParams.get("fork")) return;
    const imported = readGpxImport();
    if (imported) {
      didAutoLocate.current = true;
      void importGeometryRef.current(imported.name, imported.geometry).finally(() => {
        clearGpxImport();
      });
      return;
    }
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft.waypoints) setWaypoints(draft.waypoints);
        if (draft.geometry) setGeometry(draft.geometry);
        if (Array.isArray(draft.snapParts)) setSnapParts(draft.snapParts);
        else if (draft.geometry) setSnapParts([draft.geometry.coordinates]);
        if (Array.isArray(draft.bushwhackParts)) setBushwhackParts(draft.bushwhackParts);
        if (draft.name) setName(draft.name);
      } catch {
        /* ignore */
      }
    }
  }, [fork, searchParams]);

  useEffect(() => {
    if (didAutoLocate.current) return;
    if (fork || searchParams.get("fork") || readGpxImport()) {
      didAutoLocate.current = true;
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { waypoints?: unknown[]; geometry?: unknown };
        if ((Array.isArray(draft.waypoints) && draft.waypoints.length > 0) || draft.geometry) {
          didAutoLocate.current = true;
          return;
        }
      }
    } catch {
      /* ignore */
    }
    didAutoLocate.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pinAndFly(pos.coords.longitude, pos.coords.latitude);
        if (watchId.current != null) return;
        watchId.current = navigator.geolocation.watchPosition(
          (next) => {
            setUserLocation([next.coords.longitude, next.coords.latitude]);
          },
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 4000 },
        );
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 8000 },
    );
  }, [fork, searchParams, pinAndFly]);

  useEffect(() => {
    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ name, waypoints, geometry, snapParts, bushwhackParts }),
    );
  }, [name, waypoints, geometry, snapParts, bushwhackParts]);

  useEffect(() => {
    window.localStorage.setItem("ridgeline-dimension", pitched ? "3d" : "2d");
  }, [pitched]);

  const addPoint = (lng: number, lat: number) => {
    const kind = waypoints.length === 0 ? "start" : "end";
    const next = relabelWaypoints([
      ...waypoints.map((w) => ({ ...w, kind: w.kind === "end" ? "via" : w.kind })),
      makeWaypoint(lng, lat, kind, { bushwhack: drawMode === "bushwhack" }),
    ]);
    pushHistory({ waypoints: next, geometry, originalGeometry, snapParts, bushwhackParts, samples });
    void routeWaypoints(next);
  };

  const movePoint = (id: string, lng: number, lat: number) => {
    const next = waypoints.map((w) => (w.id === id ? { ...w, lng, lat } : w));
    pushHistory({ waypoints: next, geometry, originalGeometry, snapParts, bushwhackParts, samples });
    void routeWaypoints(next);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push({ waypoints, geometry, originalGeometry, snapParts, bushwhackParts, samples });
    elevationSeq.current += 1;
    setWaypoints(prev.waypoints);
    setGeometry(prev.geometry);
    setOriginalGeometry(prev.originalGeometry);
    setSnapParts(prev.snapParts ?? []);
    setBushwhackParts(prev.bushwhackParts ?? []);
    setSamples(prev.samples ?? []);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push({ waypoints, geometry, originalGeometry, snapParts, bushwhackParts, samples });
    elevationSeq.current += 1;
    setWaypoints(next.waypoints);
    setGeometry(next.geometry);
    setOriginalGeometry(next.originalGeometry);
    setSnapParts(next.snapParts ?? []);
    setBushwhackParts(next.bushwhackParts ?? []);
    setSamples(next.samples ?? []);
  };

  const reverse = () => {
    const next = reverseWaypointsPreservingLegs(waypoints);
    pushHistory({
      waypoints: next,
      geometry: geometry ? { ...geometry, coordinates: [...geometry.coordinates].reverse() } : null,
      originalGeometry,
      snapParts: snapParts.map((part) => [...part].reverse()).reverse(),
      bushwhackParts: bushwhackParts.map((part) => [...part].reverse()).reverse(),
      samples,
    });
    void routeWaypoints(next);
  };

  const closeLoop = () => {
    if (waypoints.length < 2) return;
    const start = waypoints[0];
    const next = relabelWaypoints([
      ...waypoints,
      makeWaypoint(start.lng, start.lat, "end", { bushwhack: drawMode === "bushwhack" }),
    ]);
    pushHistory({ waypoints: next, geometry, originalGeometry, snapParts, bushwhackParts, samples });
    void routeWaypoints(next);
  };

  const moveLoopJoin = (lng: number, lat: number) => {
    if (!canRotateLoopJoin(geometry, bushwhackParts) || !geometry) return;
    const point: LngLat = [lng, lat];
    const rotated = rotateClosedLineTo(geometry.coordinates, point);
    if (!rotated) return;
    const hit = nearestPointOnLine(geometry.coordinates, point);
    if (!hit) return;
    const total = lineDistance(geometry.coordinates);
    if (hit.distanceAlongM < 2 || hit.distanceAlongM > total - 2) return;
    const nextOriginal = originalGeometry
      ? {
          type: "LineString" as const,
          coordinates:
            rotateClosedLineTo(originalGeometry.coordinates, point) ?? originalGeometry.coordinates,
        }
      : originalGeometry;
    const nextSnap =
      snapParts.length === 1
        ? [rotateClosedLineTo(snapParts[0], point) ?? snapParts[0]]
        : [rotated];
    elevationSeq.current += 1;
    pushHistory({
      waypoints: rotateLoopWaypoints(waypoints, point, geometry),
      geometry: { type: "LineString", coordinates: rotated },
      originalGeometry: nextOriginal,
      snapParts: nextSnap,
      bushwhackParts,
      samples: rotateElevationSamples(samples, hit.distanceAlongM),
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === "Backspace" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        const next = waypoints.slice(0, -1);
        const empty = next.length < 2;
        pushHistory({
          waypoints: next,
          geometry: empty ? null : geometry,
          originalGeometry,
          snapParts: empty ? [] : snapParts,
          bushwhackParts: empty ? [] : bushwhackParts,
          samples: empty ? [] : samples,
        });
        void routeWaypoints(next);
      }
      if (
        (e.key === "b" || e.key === "B") &&
        !meta &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setDrawMode((mode) => (mode === "trail" ? "bushwhack" : "trail"));
      }
      if (meta && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (meta && e.key === "s") {
        e.preventDefault();
        setSaveOpen(true);
      }
      if (meta && e.key === "e") {
        e.preventDefault();
        exportGpx();
      }
      if (meta && e.key === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) {
          document.getElementById("place-search")?.focus();
        } else {
          setMobilePanel("search");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function exportGpx() {
    if (!geometry) {
      toast.error("Draw a line first.");
      return;
    }
    const xml = toGpx({
      name,
      coordinates: geometry.coordinates,
      elevations: samples.map((s) => s.elevationM),
    });
    const blob = new Blob([xml], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importGeometry(trackName: string, original: LineString) {
    setName(trackName);
    setOriginalGeometry(original);
    setShowOriginal(true);
    setRouting(true);
    setError(null);
    const map = mapHolder.current;
    if (map) fitTrack(map, original, { pitched });
    else pendingFit.current = original;
    try {
      const res = await fetch("/api/map/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: original.coordinates }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGeometry(original);
        setSnapParts([original.coordinates]);
        setBushwhackParts([]);
        setError(json.error ?? "Could not snap. Keeping your original track.");
        await sampleElevations(original);
      } else {
        setGeometry(json.geometry);
        setSnapParts([json.geometry.coordinates]);
        setBushwhackParts([]);
        await sampleElevations(json.geometry);
        toast.success(`Snapped with ${Math.round((json.confidence ?? 0) * 100)}% confidence`);
      }
      const start = original.coordinates[0];
      const end = original.coordinates[original.coordinates.length - 1];
      setWaypoints(
        relabelWaypoints([
          makeWaypoint(start[0], start[1], "start"),
          makeWaypoint(end[0], end[1], "end"),
        ]),
      );
      const matched = res.ok ? (json.geometry as LineString | undefined) : original;
      if (
        isClosedLoop(original.coordinates) ||
        (matched && isClosedLoop(matched.coordinates))
      ) {
        toast("Loop — drag Start along the track to change where it begins.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that GPX.");
    } finally {
      setRouting(false);
    }
  }
  importGeometryRef.current = importGeometry;

  async function onImport(file: File) {
    const text = await file.text();
    try {
      const parsed = parseGpx(text);
      await importGeometry(parsed.name ?? file.name.replace(/\.gpx$/i, ""), parsed.geometry);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that GPX.");
    }
  }

  async function saveRoute() {
    if (!geometry) {
      toast.error("Draw a line before saving.");
      return;
    }
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        geometry,
        originalGeometry,
        waypoints,
        stats,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Could not save.");
      return;
    }
    toast.success("Saved to your library");
    sessionStorage.removeItem(DRAFT_KEY);
    router.push(`/routes/${json.route.id}`);
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#07080A]">
      <MapCanvas
        styleId={styleId}
        pitched={pitched}
        geometry={geometry}
        originalGeometry={originalGeometry}
        showOriginal={showOriginal}
        trailParts={snapParts}
        bushwhackParts={bushwhackParts}
        waypoints={waypoints}
        puck={puck}
        userLocation={userLocation}
        onClickLngLat={addPoint}
        onWaypointMove={movePoint}
        onLoopJoinMove={loopJoin ? moveLoopJoin : undefined}
        onReady={(map) => {
          mapHolder.current = map;
          if (pendingFit.current) {
            fitTrack(map, pendingFit.current, { pitched });
            pendingFit.current = null;
            pendingFly.current = null;
          } else if (pendingFly.current) {
            flyMapTo(map, pendingFly.current);
            pendingFly.current = null;
          }
        }}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-4">
        <div className="pointer-events-auto glass flex min-w-0 items-center gap-4 rounded-2xl px-4 py-3">
          <Wordmark />
          <div className="hidden lg:block">
            <PlaceSearch
              proximity={userLocation}
              onSelect={(hit) => {
                mapHolder.current?.flyTo({
                  center: [hit.lng, hit.lat],
                  zoom: 13,
                  duration: 1100,
                });
              }}
            />
          </div>
        </div>
        <div className="pointer-events-auto glass hidden items-center gap-1 rounded-2xl p-1.5 lg:flex">
          <StyleToggle value={styleId} onChange={setStyleId} />
          <DimensionToggle pitched={pitched} onChange={setPitched} />
          <DrawModeToggle value={drawMode} onChange={setDrawMode} />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => locate()}
            disabled={locating}
            aria-label="Pin to my location"
            aria-pressed={userLocation != null}
            title="Pin to my location"
          >
            <LocateFixed className={`size-4 ${userLocation ? "text-[#7EB6D9]" : ""} ${locating ? "animate-pulse" : ""}`} />
          </Button>
          <Link href={userEmail ? "/routes" : "/sign-in?next=/plan"} className="px-3 text-xs text-[#C9D6E3]">
            {userEmail ?? userName ?? "Sign in"}
          </Link>
        </div>
        <div className="lg:hidden">
          <PlannerMobileHeader
            panel={mobilePanel}
            onPanelChange={setMobilePanel}
            styleId={styleId}
            onStyleId={setStyleId}
            pitched={pitched}
            onPitched={setPitched}
            drawMode={drawMode}
            onDrawMode={setDrawMode}
            locating={locating}
            userLocation={userLocation}
            onLocate={() => locate()}
            proximity={userLocation}
            onSelectPlace={(hit) => {
              mapHolder.current?.flyTo({
                center: [hit.lng, hit.lat],
                zoom: 13,
                duration: 1100,
              });
            }}
            accountHref={userEmail ? "/routes" : "/sign-in?next=/plan"}
            accountLabel={userEmail ?? userName ?? "Sign in"}
          />
        </div>
      </header>

      <aside className="pointer-events-none absolute right-4 top-24 z-10 hidden w-64 lg:block">
        <div className="pointer-events-auto glass rounded-2xl p-4">
          <WaypointPanel
            waypoints={waypoints}
            loopJoin={loopJoin}
            onUndo={undo}
            onRedo={redo}
            onReverse={reverse}
            onCloseLoop={closeLoop}
            onClear={() => {
              pushHistory({
                waypoints: [],
                geometry: null,
                originalGeometry: null,
                snapParts: [],
                bushwhackParts: [],
                samples: [],
              });
            }}
          />
        </div>
      </aside>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 lg:hidden">
        <PlannerMobileHud
          panel={mobilePanel}
          onPanelChange={setMobilePanel}
          stats={stats}
          units={units}
          onUnits={() => {
            const next = units === "imperial" ? "metric" : "imperial";
            setUnits(next);
            void fetch("/api/auth/session", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ units: next }),
            });
          }}
          samples={samples}
          hoverM={hoverM}
          onHover={setHoverM}
          routing={routing}
          error={error}
          drawMode={drawMode}
          originalGeometry={originalGeometry}
          showOriginal={showOriginal}
          onToggleOriginal={() => setShowOriginal((v) => !v)}
          onImport={() => {
            setMobilePanel(null);
            fileRef.current?.click();
          }}
          onExport={() => void exportGpx()}
          onSave={() => {
            setMobilePanel(null);
            setSaveOpen(true);
          }}
          waypoints={waypoints}
          loopJoin={loopJoin}
          onUndo={undo}
          onRedo={redo}
          onReverse={reverse}
          onCloseLoop={closeLoop}
          onClear={() => {
            pushHistory({
              waypoints: [],
              geometry: null,
              originalGeometry: null,
              snapParts: [],
              bushwhackParts: [],
              samples: [],
            });
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden p-4 lg:block">
        <div className="pointer-events-auto glass mx-auto max-w-6xl rounded-2xl p-4">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-6">
              <Stat label="Distance" value={formatDistance(stats.distanceM, units)} />
              <Stat label="Vert" value={formatVert(stats.gainM, units)} accent />
              <Stat label="Loss" value={formatVert(stats.lossM, units)} />
              <Stat label="High" value={formatElevation(stats.highM, units)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {originalGeometry ? (
                <Button size="sm" variant="secondary" onClick={() => setShowOriginal((v) => !v)}>
                  {showOriginal ? "Hide original" : "Show original"}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" />
                Import GPX
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/merge">Merge</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void exportGpx()}>
                <Download className="size-3.5" />
                Export
              </Button>
              <Button size="sm" onClick={() => setSaveOpen(true)}>
                <Save className="size-3.5" />
                Save
              </Button>
              <button
                className="text-[11px] text-[#9AA8B5]"
                onClick={() => {
                  const next = units === "imperial" ? "metric" : "imperial";
                  setUnits(next);
                  void fetch("/api/auth/session", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ units: next }),
                  });
                }}
              >
                {units === "imperial" ? "ft / mi" : "m / km"}
              </button>
            </div>
          </div>
          <ElevationProfile samples={samples} units={units} hoverM={hoverM} onHover={setHoverM} />
          <p className="mt-1 text-[11px] text-[#9AA8B5]">
            {routing
              ? "Snapping to trails…"
              : error
                ? error
                : drawMode === "bushwhack"
                  ? "Bushwhack — straight line off trail"
                  : "Snaps to trails and paths"}
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".gpx,application/gpx+xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImport(file);
          e.target.value = "";
        }}
      />

      {saveOpen && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4">
          <div className="glass w-full max-w-md max-h-[min(90dvh,32rem)] overflow-y-auto rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display italic text-2xl">Save this line</h2>
              <button onClick={() => setSaveOpen(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4"
              placeholder="Name"
            />
            <p className="mb-4 text-sm text-[#9AA8B5]">
              {userEmail
                ? `Saving to ${userEmail}.`
                : "Saved on this device. Sign in to keep it across browsers."}
            </p>
            {!userEmail && (
              <Link
                href="/sign-in?next=/plan"
                className="mb-4 inline-block text-sm text-[#E85D3A]"
              >
                Sign in with email
              </Link>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveRoute()}>Save route</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#9AA8B5]">{label}</p>
      <p className={`text-xl tracking-tight ${accent ? "text-[#E85D3A]" : "text-[#F4F1EA]"}`}>
        {value}
      </p>
    </div>
  );
}

function flyMapTo(map: import("mapbox-gl").Map, center: LngLat) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const zoom = map.getZoom() < 12.5 ? 13.2 : map.getZoom();
  map.flyTo({
    center,
    zoom,
    duration: reduce ? 0 : 1400,
    essential: true,
  });
}
