"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { formatDistance, formatDuration, formatVert } from "@/lib/geo/format";
import { ACTIVITY_META } from "@/lib/geo/types";
import type { SavedRoute } from "@/lib/geo/types";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  { ssr: false },
);

export default function PublicRoutePage() {
  const params = useParams<{ id: string }>();
  const [route, setRoute] = useState<SavedRoute | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void fetch(`/api/routes/${params.id}`).then(async (r) => {
      if (!r.ok) {
        setMissing(true);
        return;
      }
      const j = await r.json();
      setRoute(j.route);
    });
  }, [params.id]);

  if (missing) {
    return (
      <div className="grid h-dvh place-items-center bg-[#07080A] text-[#C9D6E3]">
        This line is private or gone.
      </div>
    );
  }
  if (!route) {
    return <div className="grid h-dvh place-items-center bg-[#07080A] text-[#C9D6E3]">Loading…</div>;
  }

  return (
    <div className="relative h-dvh bg-[#07080A]">
      <MapCanvas
        activity={route.activity}
        styleId="outdoors"
        pitched
        geometry={route.geometry}
        originalGeometry={null}
        showOriginal={false}
        waypoints={route.waypoints}
        puck={null}
        interactive={false}
      />
      <div className="absolute left-4 top-4 z-10 glass rounded-2xl px-4 py-3">
        <Wordmark />
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-10 mx-auto max-w-2xl">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#9AA8B5]">
            {ACTIVITY_META[route.activity].label}
          </p>
          <h1 className="font-display italic text-3xl">{route.name}</h1>
          <p className="mt-2 text-[#C9D6E3]">
            {formatDistance(route.stats.distanceM, "imperial")} · {formatVert(route.stats.gainM, "imperial")}{" "}
            vert · {formatDuration(route.stats.etaS)}
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link href={`/plan?fork=${route.id}`}>Open in planner</Link>
            </Button>
            <Button variant="secondary" asChild>
              <a href={`/api/routes/${route.id}/gpx`}>Download GPX</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
