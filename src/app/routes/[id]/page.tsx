"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { formatDistance, formatVert } from "@/lib/geo/format";
import type { SavedRoute } from "@/lib/geo/types";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  { ssr: false },
);

export default function RouteDetailPage() {
  const params = useParams<{ id: string }>();
  const [route, setRoute] = useState<SavedRoute | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    void fetch(`/api/routes/${params.id}`)
      .then((r) => r.json())
      .then((j) => {
        setRoute(j.route);
        setIsOwner(Boolean(j.isOwner));
      });
  }, [params.id]);

  if (!route) {
    return (
      <div className="grid h-dvh place-items-center bg-[#07080A] text-[#C9D6E3]">
        Loading line…
      </div>
    );
  }

  return (
    <div className="relative h-dvh bg-[#07080A]">
      <MapCanvas
        styleId="outdoors"
        pitched
        geometry={route.geometry}
        originalGeometry={route.originalGeometry}
        showOriginal={false}
        waypoints={route.waypoints}
        puck={null}
        interactive={false}
        fitToTrack
      />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="glass rounded-2xl px-4 py-3">
          <Wordmark />
        </div>
        <div className="glass flex gap-2 rounded-2xl p-2">
          <Link href="/routes" className="px-3 py-1 text-sm text-[#C9D6E3]">
            Library
          </Link>
          <a href={`/api/routes/${route.id}/gpx`} className="px-3 py-1 text-sm text-[#C9D6E3]">
            Download GPX
          </a>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-3xl">
        <div className="glass rounded-2xl p-5">
          <h1 className="font-display italic text-3xl">{route.name}</h1>
          <p className="mt-2 text-[#C9D6E3]">
            {formatDistance(route.stats.distanceM, "imperial")} ·{" "}
            {formatVert(route.stats.gainM, "imperial")} vert
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link href={`/plan?fork=${route.id}`}>Open in planner</Link>
            </Button>
            {isOwner && (
              <Button variant="secondary" asChild>
                <Link href={`/r/${route.id}`}>Public link</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
