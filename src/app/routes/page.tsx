"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionNav } from "@/components/auth/session-nav";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance, formatVert } from "@/lib/geo/format";
import type { SavedRoute } from "@/lib/geo/types";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [mine, setMine] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    const res = await fetch("/api/routes");
    const json = await res.json();
    setRoutes(json.routes ?? []);
    setMine(json.userId ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  const mineRoutes = routes.filter((r) => r.ownerId === mine);
  const visible = mineRoutes.filter((r) =>
    r.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="min-h-dvh bg-[#07080A] text-[#F4F1EA]">
      <header className="flex items-center justify-between px-6 py-5">
        <Wordmark />
        <nav className="flex items-center gap-4 text-sm text-[#C9D6E3]">
          <Link href="/plan">Planner</Link>
          <Link href="/explore">Picks</Link>
          <Link href="/merge">Merge</Link>
          <SessionNav />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-20">
        <h1 className="font-display italic text-4xl">Your lines</h1>
        <div className="mt-6 flex flex-wrap gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name"
            className="max-w-xs"
          />
        </div>
        {visible.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 p-8">
            <p className="text-[#C9D6E3]">No saved lines yet. Start from Ridgeline Picks.</p>
            <Link href="/explore" className="mt-4 inline-block text-[#E85D3A]">
              See Ridgeline Picks
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {visible.map((r) => (
              <li key={r.id} className="glass rounded-2xl p-5">
                <Link href={`/routes/${r.id}`} className="font-display italic text-2xl">
                  {r.name}
                </Link>
                <p className="mt-3 text-sm text-[#C9D6E3]">
                  {formatDistance(r.stats.distanceM, "imperial")} · {formatVert(r.stats.gainM, "imperial")} vert
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await fetch(`/api/routes/${r.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          visibility: r.visibility === "public" ? "private" : "public",
                        }),
                      });
                      void load();
                    }}
                  >
                    {r.visibility === "public" ? "Make private" : "Make public"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await fetch(`/api/routes/${r.id}`, { method: "DELETE" });
                      void load();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
