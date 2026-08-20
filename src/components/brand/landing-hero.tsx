"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ACTIVITY_META, ACTIVITIES, type Activity, type LineString } from "@/lib/geo/types";

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
        activity: "hike",
        waypoints: [
          { lng: 6.8694, lat: 45.9237 },
          { lng: 6.8875, lat: 45.9672 },
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
        activity="hike"
        styleId="outdoors"
        pitched
        geometry={geometry}
        originalGeometry={null}
        showOriginal={false}
        waypoints={[]}
        puck={null}
        interactive={false}
        initialCenter={[6.8694, 45.9237]}
        initialZoom={12.2}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07080A] via-[#07080A]/20 to-transparent" />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-6">
        <Wordmark />
        <nav className="flex items-center gap-5 text-sm text-[#C9D6E3]">
          <Link href="/explore">Picks</Link>
          <Link href="/routes">Library</Link>
          <Link href="/sign-in">Sign in</Link>
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
        <div className="mt-8 flex flex-wrap gap-2">
          {ACTIVITIES.map((a: Activity) => (
            <Link
              key={a}
              href={`/plan?activity=${a}`}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#F4F1EA]"
              style={{ boxShadow: `inset 0 0 0 1px ${ACTIVITY_META[a].color}33` }}
            >
              {ACTIVITY_META[a].label}
            </Link>
          ))}
        </div>
        <div className="mt-6 flex gap-4 text-sm">
          <Link href="/plan" className="text-[#E85D3A]">
            Open the planner
          </Link>
          <Link href="/explore" className="text-[#C9D6E3]">
            See Ridgeline Picks
          </Link>
        </div>
        <p className="mt-10 max-w-lg text-[11px] leading-relaxed text-[#9AA8B5]">
          Ski / split snaps to the walking path network — not a dedicated piste graph.
          Map data © Mapbox © OpenStreetMap.
        </p>
      </div>
    </div>
  );
}
