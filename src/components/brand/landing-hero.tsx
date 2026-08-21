"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionNav } from "@/components/auth/session-nav";
import { Wordmark } from "@/components/brand/wordmark";
import type { LineString } from "@/lib/geo/types";
import {
  CRESTED_BUTTE,
  CRESTED_BUTTE_BEARING,
  CRESTED_BUTTE_PITCH,
  CRESTED_BUTTE_ZOOM,
} from "@/lib/map/layers";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  { ssr: false },
);

export function LandingHero() {
  const [geometry, setGeometry] = useState<LineString | null>(null);

  useEffect(() => {
    void fetch("/api/map/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waypoints: [
          { lng: -106.9876, lat: 38.8697 },
          { lng: -106.9648, lat: 38.8995 },
        ],
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.geometry) setGeometry(j.geometry);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="relative h-dvh overflow-hidden bg-[#07080A]">
      <MapCanvas
        styleId="outdoors"
        pitched
        geometry={geometry}
        originalGeometry={null}
        showOriginal={false}
        waypoints={[]}
        puck={null}
        interactive={false}
        initialCenter={CRESTED_BUTTE}
        initialZoom={CRESTED_BUTTE_ZOOM}
        initialBearing={CRESTED_BUTTE_BEARING}
        initialPitch={CRESTED_BUTTE_PITCH}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080A] via-[#07080A]/20 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#07080A]/80 to-transparent"
      />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 md:p-6">
        <div className="glass rounded-2xl px-4 py-3">
          <Wordmark />
        </div>
        <nav className="glass flex items-center gap-5 rounded-2xl px-4 py-3 text-sm text-[#C9D6E3]">
          <Link href="/explore">Picks</Link>
          <Link href="/routes">Library</Link>
          <Link href="/merge">Merge</Link>
          <SessionNav />
          <Link
            href="/plan"
            className="rounded-full bg-[#E85D3A] px-4 py-2 text-[#F4F1EA]"
          >
            Open the planner
          </Link>
        </nav>
      </header>
      <div className="absolute inset-x-0 bottom-0 z-10 p-8 md:p-14">
        <p className="mb-3 text-xs uppercase tracking-[0.28em] text-[#7EB6D9]">
          Mapping for mountain athletes
        </p>
        <h1 className="font-display max-w-3xl text-5xl italic leading-[0.95] text-[#F4F1EA] md:text-7xl">
          Plan a line. Snap to the mountain.
        </h1>
        <p className="mt-5 max-w-xl text-[#C9D6E3]">
          Draw a route, snap it to real trails and roads, and read vert, miles, and grade
          before you leave the trailhead.
        </p>
        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/plan" className="text-[#E85D3A]">
            Open the planner
          </Link>
          <Link href="/explore" className="text-[#C9D6E3]">
            See Ridgeline Picks
          </Link>
        </div>
        <p className="mt-10 max-w-lg text-[11px] leading-relaxed text-[#9AA8B5]">
          Map data © Mapbox © OpenStreetMap.
        </p>
      </div>
    </div>
  );
}
