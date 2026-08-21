"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DrawMode, MapStyleId } from "@/lib/geo/types";

const STYLES: { id: MapStyleId; label: string }[] = [
  { id: "outdoors", label: "Outdoors" },
  { id: "satellite", label: "Satellite" },
  { id: "winter", label: "Winter" },
];

export function StyleToggle({
  value,
  onChange,
  stretch = false,
}: {
  value: MapStyleId;
  onChange: (id: MapStyleId) => void;
  stretch?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Map style"
      className={cn("flex", stretch && "w-full rounded-xl bg-black/25 p-0.5")}
    >
      {STYLES.map((style) => (
        <ToggleChip
          key={style.id}
          checked={value === style.id}
          stretch={stretch}
          onClick={() => onChange(style.id)}
        >
          {style.label}
        </ToggleChip>
      ))}
    </div>
  );
}

export function DimensionToggle({
  pitched,
  onChange,
  stretch = false,
}: {
  pitched: boolean;
  onChange: (pitched: boolean) => void;
  stretch?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Map dimension"
      className={cn("flex rounded-xl bg-black/25 p-0.5", stretch && "w-full")}
    >
      <ToggleChip checked={!pitched} stretch={stretch} onClick={() => onChange(false)}>
        2D
      </ToggleChip>
      <ToggleChip checked={pitched} stretch={stretch} onClick={() => onChange(true)}>
        3D
      </ToggleChip>
    </div>
  );
}

export function DrawModeToggle({
  value,
  onChange,
  stretch = false,
}: {
  value: DrawMode;
  onChange: (mode: DrawMode) => void;
  stretch?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Draw mode"
      className={cn("flex rounded-xl bg-black/25 p-0.5", stretch && "w-full")}
    >
      <ToggleChip
        checked={value === "trail"}
        stretch={stretch}
        title="Snap to trails (B)"
        onClick={() => onChange("trail")}
      >
        Trail
      </ToggleChip>
      <ToggleChip
        checked={value === "bushwhack"}
        stretch={stretch}
        title="Bushwhack — straight line off trail (B)"
        onClick={() => onChange("bushwhack")}
      >
        Bushwhack
      </ToggleChip>
    </div>
  );
}

function ToggleChip({
  checked,
  stretch,
  children,
  title,
  onClick,
}: {
  checked: boolean;
  stretch?: boolean;
  children: ReactNode;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs capitalize",
        stretch && "min-h-11 flex-1 text-sm",
        checked ? "bg-white/10 text-[#F4F1EA]" : "text-[#9AA8B5]",
      )}
    >
      {children}
    </button>
  );
}
