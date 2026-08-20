"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  LocateFixed,
  Mountain,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { MapCanvas } from "@/components/map/map-canvas";
import { ElevationProfile } from "@/components/planner/elevation-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseGpx } from "@/lib/geo/gpx-client";
import { toGpx } from "@/lib/geo/gpx";
import { formatDistance, formatDuration, formatElevation, formatVert } from "@/lib/geo/format";
import { densify, pointAlong, samplesFromElevations, statsFromSamples } from "@/lib/geo/stats";
import { makeWaypoint, relabelWaypoints } from "@/lib/geo/helpers";
import {
  ACTIVITIES,
  ACTIVITY_META,
  type Activity,
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
  initialActivity = "hike",
  fork,
}: {
  initialActivity?: Activity;
  fork?: {
    name: string;
    activity: Activity;
    waypoints: Waypoint[];
    geometry: LineString | null;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activity, setActivity] = useState<Activity>(fork?.activity ?? initialActivity);
  const [styleId, setStyleId] = useState<MapStyleId>("outdoors");
  const [pitched, setPitched] = useState(true);
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ name: string; lng: number; lat: number }[]>([]);
  const [weather, setWeather] = useState<{ tempF: number | null; windMph: number | null } | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [center, setCenter] = useState<LngLat>([6.8694, 45.9237]);
  const history = useRef<History[]>([]);
  const future = useRef<History[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const mapHolder = useRef<import("mapbox-gl").Map | null>(null);

  const stats = useMemo(() => statsFromSamples(samples, activity), [samples, activity]);
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
            activity,
            waypoints: pts.map((p) => ({ lng: p.lng, lat: p.lat })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not snap that line.");
        const geo = json.geometry as LineString;
        setGeometry(geo);
        if (original !== undefined) setOriginalGeometry(original);
        await sampleElevations(geo);
        const mid = geo.coordinates[Math.floor(geo.coordinates.length / 2)];
        if (mid) loadWeather(mid[1], mid[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Routing failed");
      } finally {
        setRouting(false);
      }
    },
    [activity],
  );

  async function sampleElevations(geo: LineString) {
    const dense = densify(geo.coordinates, 30);
    const map = mapHolder.current;
    let elevations: (number | null)[] = dense.map((c) => {
      if (!map) return null;
      const ele = map.queryTerrainElevation({ lng: c[0], lat: c[1] } as never);
      return typeof ele === "number" ? ele : null;
    });
    if (elevations.every((e) => e == null)) {
      const res = await fetch("/api/map/elevation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: dense }),
      });
      const json = await res.json();
      elevations = json.elevations ?? elevations;
    }
    setSamples(samplesFromElevations(dense, elevations));
  }

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => {
        if (j.user?.displayName) setUserName(j.user.displayName);
        if (j.user?.units) setUnits(j.user.units);
      })
      .catch(() => undefined);
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCenter([pos.coords.longitude, pos.coords.latitude]),
      () => undefined,
      { enableHighAccuracy: true, timeout: 4000 },
    );
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
        setActivity(route.activity);
        setWaypoints(route.waypoints);
        setGeometry(route.geometry);
        if (route.geometry) void sampleElevations(route.geometry);
      });
  }, [searchParams]);

  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw && !fork) {
      try {
        const draft = JSON.parse(raw);
        if (draft.waypoints) setWaypoints(draft.waypoints);
        if (draft.geometry) setGeometry(draft.geometry);
        if (draft.name) setName(draft.name);
        if (draft.activity) setActivity(draft.activity);
      } catch {
        /* ignore */
      }
    }
  }, [fork]);

  useEffect(() => {
    if (center[0] === 6.8694 && center[1] === 45.9237) return;
    mapHolder.current?.flyTo({ center, zoom: 11.8, duration: 1400 });
  }, [center]);

  useEffect(() => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ name, activity, waypoints, geometry }),
    );
  }, [name, activity, waypoints, geometry]);

  useEffect(() => {
    if (waypoints.length >= 2) {
      void routeWaypoints(waypoints);
    }
    // activity change re-snaps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

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
      if (e.key === "Escape") setResults([]);
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
      if (!meta && ["1", "2", "3", "4"].includes(e.key) && !(e.target instanceof HTMLInputElement)) {
        setActivity(ACTIVITIES[Number(e.key) - 1]);
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
      activity,
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

  async function onImport(file: File) {
    const text = await file.text();
    try {
      const parsed = parseGpx(text);
      setName(parsed.name ?? file.name.replace(/\.gpx$/i, ""));
      const original = parsed.geometry;
      setOriginalGeometry(original);
      setShowOriginal(true);
      setRouting(true);
      const res = await fetch("/api/map/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity, coordinates: original.coordinates }),
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
        activity,
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

  async function searchPlaces(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(value)}`);
    const json = await res.json();
    setResults(json.results ?? []);
  }

  function loadWeather(lat: number, lng: number) {
    fetch(`/api/map/weather?lat=${lat}&lng=${lng}`)
      .then((r) => r.json())
      .then(setWeather)
      .catch(() => undefined);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      mapHolder.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 13,
        duration: 1200,
      });
    });
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#07080A]">
      <MapCanvas
        activity={activity}
        styleId={styleId}
        pitched={pitched}
        geometry={geometry}
        originalGeometry={originalGeometry}
        showOriginal={showOriginal}
        waypoints={waypoints}
        puck={puck}
        initialCenter={center}
        onClickLngLat={addPoint}
        onWaypointMove={movePoint}
        onReady={(map) => {
          mapHolder.current = map;
        }}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
        <div className="pointer-events-auto glass flex items-center gap-4 rounded-2xl px-4 py-3">
          <Wordmark />
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2.5 size-4 text-[#9AA8B5]" />
            <Input
              id="place-search"
              value={query}
              onChange={(e) => void searchPlaces(e.target.value)}
              placeholder="Search a peak, town, trailhead"
              className="h-9 w-72 border-white/10 bg-black/30 pl-8 text-[#F4F1EA]"
            />
            {results.length > 0 && (
              <div className="absolute mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#12151A] shadow-xl">
                {results.map((r) => (
                  <button
                    key={`${r.lng}-${r.lat}`}
                    className="block w-full px-3 py-2 text-left text-sm text-[#C9D6E3] hover:bg-white/5"
                    onClick={() => {
                      mapHolder.current?.flyTo({ center: [r.lng, r.lat], zoom: 13, duration: 1100 });
                      setResults([]);
                      setQuery(r.name);
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
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
          <Button size="sm" variant="ghost" onClick={() => setPitched((v) => !v)}>
            <Mountain className="size-4" />
            3D
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={locate} aria-label="Locate me">
            <LocateFixed className="size-4" />
          </Button>
          <Link href="/sign-in" className="px-3 text-xs text-[#C9D6E3]">
            {userName ?? "Sign in"}
          </Link>
        </div>
      </header>

      <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2">
        <div
          role="radiogroup"
          aria-label="Activity"
          className="pointer-events-auto glass flex rounded-2xl p-1"
        >
          {ACTIVITIES.map((a, i) => (
            <button
              key={a}
              role="radio"
              aria-checked={activity === a}
              onClick={() => setActivity(a)}
              className={`rounded-xl px-3 py-1.5 text-xs ${activity === a ? "text-[#07080A]" : "text-[#C9D6E3]"}`}
              style={{ background: activity === a ? ACTIVITY_META[a].color : "transparent" }}
            >
              {ACTIVITY_META[a].label}
              <span className="sr-only"> shortcut {i + 1}</span>
            </button>
          ))}
        </div>
        {activity === "ski" && (
          <p className="mt-2 text-center text-[11px] text-[#C9D6E3]/80">
            Ski snaps to the path network — not a dedicated piste graph.
          </p>
        )}
      </div>

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
              <Stat label="ETA" value={formatDuration(stats.etaS)} />
              {weather?.tempF != null && (
                <Stat
                  label="Air"
                  value={`${Math.round(weather.tempF)}° · ${Math.round(weather.windMph ?? 0)} mph`}
                />
              )}
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
            {routing ? "Snapping to trails…" : error ? error : ACTIVITY_META[activity].hint}
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
              Signed in as {userName ?? "a new athlete"} — we&apos;ll create a library for you if needed.
            </p>
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
