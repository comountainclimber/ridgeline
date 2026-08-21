"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance } from "@/lib/geo/format";
import {
  firstPointTimeMs,
  mergeGpxTracks,
  mergedTrackToGpx,
  parseGpxTrack,
  sortTracksByFirstTime,
  stashGpxImport,
  trackToLineString,
  type GpxTrack,
} from "@/lib/geo/gpx-merge";
import { bboxOf, lineDistance } from "@/lib/geo/stats";
import type { LineString } from "@/lib/geo/types";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  { ssr: false },
);

type LoadedFile = {
  id: string;
  fileName: string;
  track: GpxTrack;
};

export function MergeApp() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const geometryRef = useRef<LineString | null>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [name, setName] = useState("Merged track");

  const sorted = useMemo(
    () => sortTracksByFirstTime(files, (f) => f.track),
    [files],
  );
  const merged = useMemo(() => {
    if (sorted.length === 0) return null;
    try {
      return mergeGpxTracks(sorted.map((f) => f.track));
    } catch {
      return null;
    }
  }, [sorted]);
  const geometry = merged ? trackToLineString(merged) : null;
  geometryRef.current = geometry;
  const distanceM = geometry ? lineDistance(geometry.coordinates) : 0;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geometry) return;
    fitGeometry(map, geometry);
  }, [geometry]);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: LoadedFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const text = await file.text();
        const track = parseGpxTrack(text);
        next.push({
          id: nanoid(8),
          fileName: file.name,
          track,
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? `${file.name}: ${err.message}` : `Could not read ${file.name}.`,
        );
      }
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }

  function downloadMerged() {
    if (!merged) {
      toast.error("Add at least two track points.");
      return;
    }
    const xml = mergedTrackToGpx(merged, name.trim() || "Merged track");
    const blob = new Blob([xml], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name.trim() || "merged-track").replace(/\s+/g, "-").toLowerCase()}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openInPlanner() {
    if (!geometry) {
      toast.error("Add at least two track points.");
      return;
    }
    stashGpxImport({
      name: name.trim() || "Merged track",
      geometry,
    });
    router.push("/plan");
  }

  return (
    <div className="relative h-dvh bg-[#07080A] text-[#F4F1EA]">
      <MapCanvas
        styleId="outdoors"
        pitched={false}
        geometry={geometry}
        originalGeometry={null}
        showOriginal={false}
        waypoints={[]}
        puck={null}
        interactive={false}
        onReady={(map) => {
          mapRef.current = map;
          if (geometryRef.current) fitGeometry(map, geometryRef.current);
        }}
      />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="glass rounded-2xl px-4 py-3">
          <Wordmark />
        </div>
        <nav className="glass flex items-center gap-4 rounded-2xl px-4 py-3 text-sm text-[#C9D6E3]">
          <Link href="/plan">Planner</Link>
          <Link href="/routes">Library</Link>
        </nav>
      </header>
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 md:p-4">
        <div className="glass mx-auto max-w-3xl rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-[#7EB6D9]">Utility</p>
          <h1 className="font-display mt-1 italic text-3xl">Merge GPX</h1>
          <p className="mt-2 max-w-xl text-sm text-[#C9D6E3]">
            Drop recordings in any order. They concatenate into one track, sorted by each
            file’s first timestamp.
          </p>
          {sorted.length > 0 && (
            <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto text-sm">
              {sorted.map((f, i) => (
                <li key={f.id} className="flex items-center justify-between gap-3 text-[#F4F1EA]">
                  <span className="min-w-0 truncate">
                    <span className="text-[#9AA8B5]">{i + 1}.</span> {f.fileName}
                    <span className="ml-2 text-[11px] text-[#9AA8B5]">
                      {f.track.points.length} pts · {formatFirstTime(f.track)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.fileName}`}
                    className="shrink-0 text-[#9AA8B5]"
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-[12rem] flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-[#9AA8B5]">
                Name
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Merged track"
              />
            </label>
            {merged && (
              <p className="pb-1 text-sm text-[#C9D6E3]">
                {merged.points.length} pts · {formatDistance(distanceM, "imperial")}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" />
              Add GPX
            </Button>
            <Button size="sm" variant="secondary" disabled={!merged} onClick={downloadMerged}>
              <Download className="size-3.5" />
              Download
            </Button>
            <Button size="sm" disabled={!merged} onClick={openInPlanner}>
              Open in planner
            </Button>
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".gpx,application/gpx+xml,text/xml"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function formatFirstTime(track: GpxTrack): string {
  const ms = firstPointTimeMs(track);
  if (ms == null) return "no time";
  return `${new Date(ms).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function fitGeometry(map: import("mapbox-gl").Map, geometry: LineString) {
  const box = bboxOf(geometry.coordinates);
  if (!box) return;
  map.fitBounds(
    [
      [box[0], box[1]],
      [box[2], box[3]],
    ],
    { padding: 72, duration: 800, maxZoom: 14 },
  );
}
