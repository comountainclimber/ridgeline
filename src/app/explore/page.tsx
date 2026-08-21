"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/brand/site-nav";
import { formatDistance, formatVert } from "@/lib/geo/format";
import type { SavedRoute } from "@/lib/geo/types";

export default function ExplorePage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);

  useEffect(() => {
    void fetch("/api/explore")
      .then((r) => r.json())
      .then((j) => setRoutes(j.routes ?? []));
  }, []);

  return (
    <div className="min-h-dvh bg-[#07080A] text-[#F4F1EA]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 md:px-6">
        <p className="text-xs uppercase tracking-[0.28em] text-[#7EB6D9]">Worldwide</p>
        <h1 className="font-display italic text-4xl md:text-5xl">Ridgeline Picks</h1>
        <p className="mt-3 max-w-xl text-[#C9D6E3]">
          Iconic lines. Open any of them, then make it yours.
        </p>
        {routes.length === 0 ? (
          <p className="mt-10 text-[#9AA8B5]">
            Picks are seeding. Open the planner and draw your own line in the meantime.
          </p>
        ) : (
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {routes.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${r.id}`} className="glass block rounded-2xl p-5 transition hover:border-white/25">
                  <h2 className="font-display italic text-2xl">{r.name}</h2>
                  <p className="mt-2 text-sm text-[#C9D6E3]">
                    {formatDistance(r.stats.distanceM, "imperial")} · {formatVert(r.stats.gainM, "imperial")} vert
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
