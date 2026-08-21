"use client";

import type { PointerEvent } from "react";
import type { ElevationSample, Units } from "@/lib/geo/types";
import { formatElevation, formatGrade } from "@/lib/geo/format";
import { cn } from "@/lib/utils";

type Props = {
  samples: ElevationSample[];
  units: Units;
  hoverM: number | null;
  onHover: (distanceM: number | null) => void;
  compact?: boolean;
};

export function ElevationProfile({ samples, units, hoverM, onHover, compact }: Props) {
  const frame = compact ? "h-14" : "h-[88px]";

  if (samples.length < 2) {
    return (
      <div className={cn("flex items-center justify-center px-1 text-[#9AA8B5]", frame, compact ? "text-center text-xs" : "text-sm")}>
        {compact
          ? "Tap the map to drop a start."
          : "Click the map to drop a start, then a second point — the profile will draw here."}
      </div>
    );
  }

  const width = 640;
  const height = compact ? 56 : 88;
  const pad = 8;
  const minE = Math.min(...samples.map((s) => s.elevationM));
  const maxE = Math.max(...samples.map((s) => s.elevationM));
  const maxD = samples[samples.length - 1].distanceM || 1;
  const span = Math.max(20, maxE - minE);

  const d = samples
    .map((s, i) => {
      const x = pad + (s.distanceM / maxD) * (width - pad * 2);
      const y = height - pad - ((s.elevationM - minE) / span) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const hover = hoverM != null ? samples.reduce((best, s) =>
    Math.abs(s.distanceM - hoverM) < Math.abs(best.distanceM - hoverM) ? s : best,
  ) : null;
  const hx = hover ? pad + (hover.distanceM / maxD) * (width - pad * 2) : 0;

  function distanceAt(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left) / Math.max(rect.width, 1);
    onHover(Math.max(0, Math.min(1, t)) * maxD);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("w-full touch-none", frame)}
        role="img"
        aria-label="Elevation profile"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          distanceAt(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.currentTarget.hasPointerCapture(e.pointerId)) {
            distanceAt(e);
          }
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse") onHover(null);
        }}
        onPointerCancel={() => onHover(null)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") onHover(null);
        }}
        onKeyDown={(e) => {
          if (hoverM == null) {
            onHover(0);
            return;
          }
          const step = maxD / 40;
          if (e.key === "ArrowRight") onHover(Math.min(maxD, hoverM + step));
          if (e.key === "ArrowLeft") onHover(Math.max(0, hoverM - step));
        }}
        tabIndex={0}
      >
        <path d={`${d} L${width - pad},${height - pad} L${pad},${height - pad} Z`} fill="rgba(232,93,58,0.16)" />
        <path d={d} fill="none" stroke="#E85D3A" strokeWidth="2.2" />
        {hover ? (
          <>
            <line x1={hx} x2={hx} y1={pad} y2={height - pad} stroke="#F4F1EA" strokeOpacity="0.45" />
            <circle
              cx={hx}
              cy={
                height -
                pad -
                ((hover.elevationM - minE) / span) * (height - pad * 2)
              }
              r="4"
              fill="#F4F1EA"
            />
          </>
        ) : null}
      </svg>
      {hover ? (
        <div className="pointer-events-none absolute right-3 top-2 text-[11px] tracking-wide text-[#C9D6E3]">
          {formatElevation(hover.elevationM, units)} · {formatGrade(hover.grade)}
        </div>
      ) : null}
    </div>
  );
}
