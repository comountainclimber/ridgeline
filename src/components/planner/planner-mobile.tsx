"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Download,
  Ellipsis,
  List,
  LocateFixed,
  Redo2,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Undo2,
  Upload,
} from "lucide-react";
import { PlaceSearch } from "@/components/planner/place-search";
import { ElevationProfile } from "@/components/planner/elevation-profile";
import {
  DimensionToggle,
  DrawModeToggle,
  StyleToggle,
} from "@/components/planner/map-toggles";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDistance, formatElevation, formatVert } from "@/lib/geo/format";
import type {
  DrawMode,
  ElevationSample,
  LineString,
  LngLat,
  MapStyleId,
  RouteStats,
  Units,
  Waypoint,
} from "@/lib/geo/types";
import type { GeocodeHit } from "@/lib/mapbox/geocode";

export type MobilePanel = "search" | "menu" | "waypoints" | "more" | null;

export function PlannerMobileHeader({
  panel,
  onPanelChange,
  styleId,
  onStyleId,
  pitched,
  onPitched,
  drawMode,
  onDrawMode,
  locating,
  userLocation,
  onLocate,
  proximity,
  onSelectPlace,
  accountHref,
  accountLabel,
}: {
  panel: MobilePanel;
  onPanelChange: (panel: MobilePanel) => void;
  styleId: MapStyleId;
  onStyleId: (id: MapStyleId) => void;
  pitched: boolean;
  onPitched: (pitched: boolean) => void;
  drawMode: DrawMode;
  onDrawMode: (mode: DrawMode) => void;
  locating: boolean;
  userLocation: LngLat | null;
  onLocate: () => void;
  proximity: LngLat | null;
  onSelectPlace: (hit: GeocodeHit) => void;
  accountHref: string;
  accountLabel: string;
}) {
  return (
    <>
      <div className="pointer-events-auto glass flex items-center gap-0.5 rounded-2xl p-1">
        <IconBtn
          label="Search a place"
          onClick={() => onPanelChange("search")}
        >
          <Search className="size-4" />
        </IconBtn>
        <IconBtn
          label="Pin to my location"
          pressed={userLocation != null}
          disabled={locating}
          onClick={onLocate}
        >
          <LocateFixed
            className={`size-4 ${userLocation ? "text-[#7EB6D9]" : ""} ${locating ? "animate-pulse" : ""}`}
          />
        </IconBtn>
        <IconBtn label="Map and draw controls" onClick={() => onPanelChange("menu")}>
          <SlidersHorizontal className="size-4" />
        </IconBtn>
      </div>

      <Sheet
        open={panel === "search"}
        onOpenChange={(open) => onPanelChange(open ? "search" : null)}
      >
        <SheetContent
          side="top"
          className="gap-3 border-white/10 bg-[#12151A] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            document.getElementById("place-search-mobile")?.focus();
          }}
        >
          <SheetHeader className="p-0 pr-10">
            <SheetTitle className="text-[#F4F1EA]">Find a place</SheetTitle>
            <SheetDescription>Search a peak, town, or trailhead.</SheetDescription>
          </SheetHeader>
          <PlaceSearch
            inputId="place-search-mobile"
            variant="inline"
            proximity={proximity}
            onSelect={(hit) => {
              onSelectPlace(hit);
              onPanelChange(null);
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={panel === "menu"}
        onOpenChange={(open) => onPanelChange(open ? "menu" : null)}
      >
        <SheetContent
          side="bottom"
          className="gap-0 border-white/10 bg-[#12151A] p-0 text-[#F4F1EA]"
        >
          <SheetHeader className="border-b border-white/10 pr-12">
            <SheetTitle className="font-display italic text-xl text-[#F4F1EA]">
              Map
            </SheetTitle>
            <SheetDescription>Basemap, dimension, and draw mode.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ControlBlock label="Basemap">
              <StyleToggle value={styleId} onChange={onStyleId} stretch />
            </ControlBlock>
            <ControlBlock label="Dimension">
              <DimensionToggle pitched={pitched} onChange={onPitched} stretch />
            </ControlBlock>
            <ControlBlock label="Draw">
              <DrawModeToggle value={drawMode} onChange={onDrawMode} stretch />
            </ControlBlock>
            <div className="border-t border-white/10 pt-4">
              <Link
                href={accountHref}
                className="flex min-h-11 items-center rounded-xl px-3 text-sm text-[#C9D6E3]"
              >
                {accountLabel}
              </Link>
              <Link
                href="/routes"
                className="flex min-h-11 items-center rounded-xl px-3 text-sm text-[#C9D6E3]"
              >
                Library
              </Link>
              <Link
                href="/explore"
                className="flex min-h-11 items-center rounded-xl px-3 text-sm text-[#C9D6E3]"
              >
                Picks
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function PlannerMobileHud({
  panel,
  onPanelChange,
  stats,
  units,
  onUnits,
  samples,
  hoverM,
  onHover,
  routing,
  error,
  drawMode,
  originalGeometry,
  showOriginal,
  onToggleOriginal,
  onImport,
  onExport,
  onSave,
  waypoints,
  onUndo,
  onRedo,
  onReverse,
  onCloseLoop,
  onClear,
}: {
  panel: MobilePanel;
  onPanelChange: (panel: MobilePanel) => void;
  stats: RouteStats;
  units: Units;
  onUnits: () => void;
  samples: ElevationSample[];
  hoverM: number | null;
  onHover: (distanceM: number | null) => void;
  routing: boolean;
  error: string | null;
  drawMode: DrawMode;
  originalGeometry: LineString | null;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onImport: () => void;
  onExport: () => void;
  onSave: () => void;
  waypoints: Waypoint[];
  onUndo: () => void;
  onRedo: () => void;
  onReverse: () => void;
  onCloseLoop: () => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="pointer-events-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass mx-auto max-w-6xl rounded-2xl p-3">
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Distance" value={formatDistance(stats.distanceM, units)} />
            <MiniStat label="Vert" value={formatVert(stats.gainM, units)} accent />
            <MiniStat label="Loss" value={formatVert(stats.lossM, units)} />
            <MiniStat label="High" value={formatElevation(stats.highM, units)} />
          </div>
          <ElevationProfile
            compact
            samples={samples}
            units={units}
            hoverM={hoverM}
            onHover={onHover}
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button
              size="lg"
              variant="secondary"
              className="min-h-11"
              onClick={() => onPanelChange("waypoints")}
            >
              <List className="size-4" />
              Points
            </Button>
            <Button size="lg" className="min-h-11" onClick={onSave}>
              <Save className="size-4" />
              Save
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="min-h-11"
              onClick={() => onPanelChange("more")}
            >
              <Ellipsis className="size-4" />
              More
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-[#9AA8B5]">
            {routing
              ? "Snapping to trails…"
              : error
                ? error
                : drawMode === "bushwhack"
                  ? "Bushwhack — straight line off trail"
                  : "Snaps to trails and paths"}
          </p>
        </div>
      </div>

      <Sheet
        open={panel === "waypoints"}
        onOpenChange={(open) => onPanelChange(open ? "waypoints" : null)}
      >
        <SheetContent
          side="bottom"
          className="gap-0 border-white/10 bg-[#12151A] p-0 text-[#F4F1EA]"
        >
          <SheetHeader className="border-b border-white/10 pr-12">
            <SheetTitle className="text-[#F4F1EA]">Waypoints</SheetTitle>
            <SheetDescription>
              {waypoints.length === 0
                ? "Tap the map to start a line."
                : `${waypoints.length} pin${waypoints.length === 1 ? "" : "s"} on this line.`}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <WaypointPanel
              showHeading={false}
              waypoints={waypoints}
              onUndo={onUndo}
              onRedo={onRedo}
              onReverse={onReverse}
              onCloseLoop={onCloseLoop}
              onClear={onClear}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={panel === "more"}
        onOpenChange={(open) => onPanelChange(open ? "more" : null)}
      >
        <SheetContent
          side="bottom"
          className="gap-0 border-white/10 bg-[#12151A] p-0 text-[#F4F1EA]"
        >
          <SheetHeader className="border-b border-white/10 pr-12">
            <SheetTitle className="text-[#F4F1EA]">Line actions</SheetTitle>
            <SheetDescription>Import, export, and units.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {originalGeometry ? (
              <Button size="lg" variant="secondary" className="min-h-11 justify-start" onClick={onToggleOriginal}>
                {showOriginal ? "Hide original GPX" : "Show original GPX"}
              </Button>
            ) : null}
            <Button size="lg" variant="secondary" className="min-h-11 justify-start" onClick={onImport}>
              <Upload className="size-4" />
              Import GPX
            </Button>
            <Button size="lg" variant="secondary" className="min-h-11 justify-start" asChild>
              <Link href="/merge">Merge tracks</Link>
            </Button>
            <Button size="lg" variant="secondary" className="min-h-11 justify-start" onClick={onExport}>
              <Download className="size-4" />
              Export GPX
            </Button>
            <Button size="lg" variant="ghost" className="min-h-11 justify-start" onClick={onUnits}>
              {units === "imperial" ? "Use meters / km" : "Use feet / miles"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function WaypointPanel({
  waypoints,
  onUndo,
  onRedo,
  onReverse,
  onCloseLoop,
  onClear,
  showHeading = true,
}: {
  waypoints: Waypoint[];
  onUndo: () => void;
  onRedo: () => void;
  onReverse: () => void;
  onCloseLoop: () => void;
  onClear: () => void;
  showHeading?: boolean;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        {showHeading ? (
          <p className="text-xs uppercase tracking-[0.18em] text-[#9AA8B5]">Waypoints</p>
        ) : (
          <span />
        )}
        <div className="flex gap-1">
          <Button size="icon-xs" variant="ghost" onClick={onUndo} aria-label="Undo">
            <Undo2 />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={onRedo} aria-label="Redo">
            <Redo2 />
          </Button>
        </div>
      </div>
      <ol className="space-y-2 text-sm">
        {waypoints.length === 0 ? (
          <li className="text-[#9AA8B5]">Click the mountain to start.</li>
        ) : null}
        {waypoints.map((w) => (
          <li key={w.id} className="flex justify-between gap-2 text-[#F4F1EA]">
            <span>
              {w.label}
              {w.bushwhack && w.kind !== "start" ? (
                <span className="ml-1 text-[11px] text-[#9AA8B5]">off trail</span>
              ) : null}
            </span>
            <span className="text-[11px] text-[#9AA8B5]">
              {w.lat.toFixed(3)}, {w.lng.toFixed(3)}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onReverse}>
          Reverse
        </Button>
        <Button size="sm" variant="secondary" onClick={onCloseLoop}>
          Close loop
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <RotateCcw className="size-3.5" />
          Clear
        </Button>
      </div>
    </>
  );
}

function ControlBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#9AA8B5]">{label}</p>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#9AA8B5]">{label}</p>
      <p
        className={`truncate text-base tracking-tight sm:text-lg ${accent ? "text-[#E85D3A]" : "text-[#F4F1EA]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function IconBtn({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant="ghost"
      className="size-11 text-[#F4F1EA]"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
