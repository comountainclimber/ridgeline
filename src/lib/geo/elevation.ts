import type { LineString, LngLat, RouteStats } from "./types";
import {
  densify,
  ELEVATION_MAX_SAMPLES,
  ELEVATION_SAMPLE_M,
  elevationSampleIndices,
  interpolateElevationsAlong,
  statsFromLine,
} from "./stats";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchElevations(
  coordinates: LngLat[],
  opts?: { retries?: number; retryDelayMs?: number },
): Promise<(number | null)[]> {
  if (coordinates.length === 0) return [];
  const sampleIdx = elevationSampleIndices(coordinates.length, ELEVATION_MAX_SAMPLES);
  const sample = sampleIdx.map((i) => coordinates[i]);
  const lats = sample.map((c) => c[1]).join(",");
  const lngs = sample.map((c) => c[0]).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
  const retries = opts?.retries ?? 0;
  let lastStatus = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { cache: "no-store" });
    lastStatus = res.status;
    if (res.ok) {
      const json = (await res.json()) as { elevation?: number[] };
      const sampled = json.elevation ?? [];
      return interpolateElevationsAlong(
        coordinates.length,
        sampleIdx,
        sampled.map((e) => (typeof e === "number" && Number.isFinite(e) ? e : null)),
      );
    }
    if (res.status === 429 && attempt < retries) {
      await sleep((opts?.retryDelayMs ?? 20_000) * (attempt + 1));
      continue;
    }
    break;
  }
  throw new Error(lastStatus === 429 ? "Elevation rate-limited" : "Elevation unavailable");
}

export async function statsWithElevation(
  geometry: LineString,
  opts?: { retries?: number; retryDelayMs?: number },
): Promise<RouteStats> {
  const dense = densify(geometry.coordinates, ELEVATION_SAMPLE_M);
  const elevations = await fetchElevations(dense, opts);
  return statsFromLine({ type: "LineString", coordinates: dense }, elevations);
}
