import type { Units } from "./types";

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export function formatDistance(meters: number, units: Units): string {
  if (units === "metric") {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 2)} km`;
  }
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return `${Math.round(meters / METERS_PER_FOOT)} ft`;
  return `${miles.toFixed(miles >= 10 ? 1 : 2)} mi`;
}

export function formatVert(meters: number, units: Units): string {
  if (units === "metric") return `${Math.round(meters)} m`;
  return `${Math.round(meters / METERS_PER_FOOT).toLocaleString("en-US")} ft`;
}

export function formatElevation(meters: number | null, units: Units): string {
  if (meters == null) return "—";
  return formatVert(meters, units);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatGrade(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function metersToFeet(meters: number): number {
  return meters / METERS_PER_FOOT;
}
