"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  LocateFixed,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { MapCanvas, fitTrack } from "@/components/map/map-canvas";
import { ElevationProfile } from "@/components/planner/elevation-profile";
import { PlaceSearch } from "@/components/planner/place-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseGpx } from "@/lib/geo/gpx-client";
import { toGpx } from "@/lib/geo/gpx";
import { clearGpxImport, readGpxImport } from "@/lib/geo/gpx-merge";
import { formatDistance, formatElevation, formatVert } from "@/lib/geo/format";
import {
  ELEVATION_SAMPLE_M,
  densify,
  pointAlong,
  prepareElevationSamples,
  statsFromSamples,
} from "@/lib/geo/stats";
import { makeWaypoint, relabelWaypoints } from "@/lib/geo/helpers";
import {
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
};

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
  const importGeometryRef = useRef<(trackName: string, original: LineString) => Promise<void>>(
    async () => undefined,
  );

  const stats = useMemo(() => statsFromSamples(samples), [samples]);
  const puck = hoverM != null && geometry ? pointAlong(geometry.coordinates, hoverM) : null;

  const pushHistory = useCallback((next: History) => {
    history.current.push({
      waypoints,
      geometry,
      originalGeometry,
    });
    future.current = [];
    if (history.current.length > 40) history.current.shift();
    setWaypoints(next.waypoints);
    setGeometry(next.geometry);
    setOriginalGeometry(next.originalGeometry);
  }, [geometry, originalGeometry, waypoints]);

  const routeWaypoints = useCallback(
    async (pts: Waypoint[], original?: LineString | null) => {
      if (pts.length < 2) {
        setGeometry(null);
        setSamples([]);
        return;
      }
      setRouting(true);
      setError(null);
      try {
        const res = await fetch("/api/map/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waypoints: pts.map((p) => ({ lng: p.lng, lat: p.lat })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not snap that line.");
        const geo = json.geometry as LineString;
        setGeometry(geo);
        if (original !== undefined) setOriginalGeometry(original);
        await sampleElevations(geo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Routing failed");
      } finally {
        setRouting(false);
      }
    },
    [],
  );

  async function sampleElevations(geo: LineString) {
    const dense = densify(geo.coordinates, ELEVATION_SAMPLE_M);
    const res = await fetch("/api/map/elevation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: dense }),
    });
    const json = await res.json().catch(() => ({}));
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
      JSON.stringify({ name, waypoints, geometry }),
    );
  }, [name, waypoints, geometry]);

  useEffect(() => {
    window.localStorage.setItem("ridgeline-dimension", pitched ? "3d" : "2d");
  }, [pitched]);

  const addPoint = (lng: number, lat: number) => {
    const kind = waypoints.length === 0 ? "start" : "end";
    const next = relabelWaypoints([...waypoints.map((w) => ({ ...w, kind: w.kind === "end" ? "via" : w.kind })), makeWaypoint(lng, lat, kind)]);
    pushHistory({ waypoints: next, geometry, originalGeometry });
    void routeWaypoints(next);
  };

  const movePoint = (id: string, lng: number, lat: number) => {
    const next = waypoints.map((w) => (w.id === id ? { ...w, lng, lat } : w));
    pushHistory({ waypoints: next, geometry, originalGeometry });
    void routeWaypoints(next);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push({ waypoints, geometry, originalGeometry });
    setWaypoints(prev.waypoints);
    setGeometry(prev.geometry);
    setOriginalGeometry(prev.originalGeometry);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push({ waypoints, geometry, originalGeometry });
    setWaypoints(next.waypoints);
    setGeometry(next.geometry);
    setOriginalGeometry(next.originalGeometry);
  };

  const reverse = () => {
    const next = relabelWaypoints([...waypoints].reverse());
    pushHistory({ waypoints: next, geometry: geometry ? { ...geometry, coordinates: [...geometry.coordinates].reverse() } : null, originalGeometry });
    void routeWaypoints(next);
  };

  const closeLoop = () => {
    if (waypoints.length < 2) return;
    const start = waypoints[0];
    const next = relabelWaypoints([...waypoints, makeWaypoint(start.lng, start.lat, "end")]);
    pushHistory({ waypoints: next, geometry, originalGeometry });
    void routeWaypoints(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (e.key === "Backspace" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        const next = waypoints.slice(0, -1);
        pushHistory({ waypoints: next, geometry: next.length < 2 ? null : geometry, originalGeometry });
        void routeWaypoints(next);
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
        document.getElementById("place-search")?.focus();
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
        setError(json.error ?? "Could not snap. Keeping your original track.");
        await sampleElevations(original);
      } else {
        setGeometry(json.geometry);
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
      toast.error("Snap a line before saving.");
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
        waypoints={waypoints}
        puck={puck}
        userLocation={userLocation}
        onClickLngLat={addPoint}
        onWaypointMove={movePoint}
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

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
        <div className="pointer-events-auto glass flex items-center gap-4 rounded-2xl px-4 py-3">
          <Wordmark />
          <div className="hidden md:block">
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
        <div className="pointer-events-auto glass flex items-center gap-1 rounded-2xl p-1.5">
          {(["outdoors", "satellite", "winter"] as MapStyleId[]).map((id) => (
            <button
              key={id}
              onClick={() => setStyleId(id)}
              className={`rounded-xl px-3 py-1.5 text-xs capitalize ${styleId === id ? "bg-white/10 text-[#F4F1EA]" : "text-[#9AA8B5]"}`}
            >
              {id}
            </button>
          ))}
          <div
            role="radiogroup"
            aria-label="Map dimension"
            className="flex rounded-xl bg-black/25 p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!pitched}
              onClick={() => setPitched(false)}
              className={`rounded-lg px-3 py-1.5 text-xs ${!pitched ? "bg-white/10 text-[#F4F1EA]" : "text-[#9AA8B5]"}`}
            >
              2D
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={pitched}
              onClick={() => setPitched(true)}
              className={`rounded-lg px-3 py-1.5 text-xs ${pitched ? "bg-white/10 text-[#F4F1EA]" : "text-[#9AA8B5]"}`}
            >
              3D
            </button>
          </div>
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
      </header>

      <aside className="pointer-events-none absolute right-4 top-24 z-10 hidden w-64 lg:block">
        <div className="pointer-events-auto glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9AA8B5]">Waypoints</p>
            <div className="flex gap-1">
              <Button size="icon-xs" variant="ghost" onClick={undo} aria-label="Undo">
                <Undo2 />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={redo} aria-label="Redo">
                <Redo2 />
              </Button>
            </div>
          </div>
          <ol className="space-y-2 text-sm">
            {waypoints.length === 0 && (
              <li className="text-[#9AA8B5]">Click the mountain to start.</li>
            )}
            {waypoints.map((w) => (
              <li key={w.id} className="flex justify-between text-[#F4F1EA]">
                <span>{w.label}</span>
                <span className="text-[11px] text-[#9AA8B5]">
                  {w.lat.toFixed(3)}, {w.lng.toFixed(3)}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={reverse}>
              Reverse
            </Button>
            <Button size="sm" variant="secondary" onClick={closeLoop}>
              Close loop
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                pushHistory({ waypoints: [], geometry: null, originalGeometry: null });
                setSamples([]);
              }}
            >
              <RotateCcw className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </aside>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 md:p-4">
        <div className="pointer-events-auto glass mx-auto max-w-6xl rounded-2xl p-3 md:p-4">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-6">
              <Stat label="Distance" value={formatDistance(stats.distanceM, units)} />
              <Stat label="Vert" value={formatVert(stats.gainM, units)} accent />
              <Stat label="Loss" value={formatVert(stats.lossM, units)} />
              <Stat label="High" value={formatElevation(stats.highM, units)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {originalGeometry && (
                <Button size="sm" variant="secondary" onClick={() => setShowOriginal((v) => !v)}>
                  {showOriginal ? "Hide original" : "Show original"}
                </Button>
              )}
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
            {routing ? "Snapping to trails…" : error ? error : "Snaps to trails and paths"}
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
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-5">
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
