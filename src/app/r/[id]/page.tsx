"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/brand/site-nav";
import { Button } from "@/components/ui/button";
import { formatDistance, formatVert } from "@/lib/geo/format";
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
        styleId="outdoors"
        pitched
        geometry={route.geometry}
        originalGeometry={null}
        showOriginal={false}
        waypoints={route.waypoints}
        puck={null}
        interactive={false}
        fitToTrack
      />
      <SiteHeader overlay />
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4">
        <div className="glass mx-auto max-w-2xl rounded-2xl p-4 md:p-5">
          <h1 className="font-display italic text-2xl md:text-3xl">{route.name}</h1>
          <p className="mt-2 text-[#C9D6E3]">
            {formatDistance(route.stats.distanceM, "imperial")} · {formatVert(route.stats.gainM, "imperial")} vert
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
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
