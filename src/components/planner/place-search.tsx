"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, MapPin, Mountain, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GeocodeHit } from "@/lib/mapbox/geocode";
import type { LngLat } from "@/lib/geo/types";

export function PlaceSearch({
  proximity,
  onSelect,
  variant = "popover",
  inputId = "place-search",
}: {
  proximity?: LngLat | null;
  onSelect: (hit: GeocodeHit) => void;
  variant?: "popover" | "inline";
  inputId?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const proximityRef = useRef(proximity);
  const timerRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  proximityRef.current = proximity;

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function pick(hit: GeocodeHit) {
    window.clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setQuery(hit.name);
    setResults([]);
    setOpen(false);
    setLoading(false);
    onSelect(hit);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    window.clearTimeout(timerRef.current);
    abortRef.current?.abort();
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timerRef.current = window.setTimeout(() => {
      void search(trimmed);
    }, 180);
  }

  async function search(value: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const params = new URLSearchParams({ q: value });
      const prox = proximityRef.current;
      if (prox) {
        params.set("lng", String(prox[0]));
        params.set("lat", String(prox[1]));
      }
      const res = await fetch(`/api/map/geocode?${params}`, { signal: ac.signal });
      const json = (await res.json()) as { results?: GeocodeHit[] };
      setResults(json.results ?? []);
      setActive(0);
      setOpen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResults([]);
      setOpen(true);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }

  const showList = open && query.trim().length >= 2;

  const field = (
    <div className={cn("relative", variant === "inline" ? "w-full" : "w-72")}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[#9AA8B5]" />
      <Input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={
          showList && results[active] ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!showList) return;
            setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            const hit = results[active] ?? results[0];
            if (showList && hit) {
              e.preventDefault();
              pick(hit);
            }
          } else if (e.key === "Escape") {
            if (showList) {
              e.preventDefault();
              setOpen(false);
            }
          }
        }}
        placeholder="Search a peak, town, trailhead"
        className="h-11 border-white/10 bg-black/30 pr-8 pl-8 text-base text-[#F4F1EA] md:h-9 md:text-sm"
      />
      {loading ? (
        <Loader2 className="pointer-events-none absolute right-2.5 top-3 size-4 animate-spin text-[#9AA8B5] md:top-2.5" />
      ) : null}
    </div>
  );

  const list = (
    <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto">
      {results.length === 0 ? (
        <li className="px-3 py-2 text-sm text-[#9AA8B5]">
          {loading ? "Searching…" : "No matching places"}
        </li>
      ) : (
        results.map((hit, i) => {
          const Icon = hit.kind === "poi" ? Mountain : MapPin;
          return (
            <li key={`${hit.lng}-${hit.lat}-${hit.name}`} role="none">
              <button
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`flex min-h-11 w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                  i === active ? "bg-white/10 text-[#F4F1EA]" : "text-[#C9D6E3]"
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-[#9AA8B5]" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {emphasize(hit.name, query)}
                  </span>
                  {hit.context ? (
                    <span className="mt-0.5 block truncate text-xs text-[#9AA8B5]">
                      {hit.context}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  );

  if (variant === "inline") {
    return (
      <div>
        {field}
        {showList ? (
          <div className="mt-2 rounded-lg ring-1 ring-white/10">{list}</div>
        ) : null}
      </div>
    );
  }

  return (
    <Popover
      open={showList}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}
    >
      <PopoverAnchor asChild>{field}</PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-[min(18rem,calc(100vw-2rem))] border-white/10 bg-[#12151A] p-1 text-[#C9D6E3] shadow-xl"
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}

function emphasize(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#E85D3A]">{text.slice(i, i + needle.length)}</span>
      {text.slice(i + needle.length)}
    </>
  );
}
