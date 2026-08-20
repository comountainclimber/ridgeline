import type { Activity, ElevationSample, LineString, LngLat, RouteStats } from "./types";

const EARTH_M = 6371000;
const DEADBAND_M = 3;
const SAMPLE_EVERY_M = 30;

export function haversine(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineDistance(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1], coords[i]);
  }
  return total;
}

export function interpolate(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Densify a line to roughly `everyM` spacing for elevation sampling. */
export function densify(coords: LngLat[], everyM = SAMPLE_EVERY_M): LngLat[] {
  if (coords.length < 2) return coords.slice();
  const out: LngLat[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = haversine(a, b);
    const steps = Math.max(1, Math.round(d / everyM));
    for (let s = 1; s <= steps; s++) {
      out.push(interpolate(a, b, s / steps));
    }
  }
  return out;
}

export function bboxOf(coords: LngLat[]): [number, number, number, number] | null {
  if (!coords.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function samplesFromElevations(
  points: LngLat[],
  elevations: (number | null)[],
): ElevationSample[] {
  const samples: ElevationSample[] = [];
  let dist = 0;
  let prevEle: number | null = null;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) dist += haversine(points[i - 1], points[i]);
    const ele = elevations[i];
    if (ele == null || !Number.isFinite(ele)) continue;
    let grade = 0;
    if (i > 0 && prevEle != null) {
      const run = haversine(points[i - 1], points[i]);
      if (run > 0.5) grade = ((ele - prevEle) / run) * 100;
    }
    samples.push({
      distanceM: dist,
      elevationM: ele,
      grade,
      lng: points[i][0],
      lat: points[i][1],
    });
    prevEle = ele;
  }
  return samples;
}

export function statsFromSamples(
  samples: ElevationSample[],
  activity: Activity,
): RouteStats {
  if (samples.length === 0) {
    return {
      distanceM: 0,
      gainM: 0,
      lossM: 0,
      highM: null,
      lowM: null,
      maxGrade: null,
      avgUpGrade: null,
      etaS: 0,
    };
  }

  let gain = 0;
  let loss = 0;
  let last = samples[0].elevationM;
  let high = samples[0].elevationM;
  let low = samples[0].elevationM;
  let maxGrade = 0;
  let upGradeSum = 0;
  let upGradeN = 0;

  for (let i = 1; i < samples.length; i++) {
    const ele = samples[i].elevationM;
    high = Math.max(high, ele);
    low = Math.min(low, ele);
    const d = ele - last;
    if (Math.abs(d) >= DEADBAND_M) {
      if (d > 0) gain += d;
      else loss += -d;
      last = ele;
    }
    const g = Math.abs(samples[i].grade);
    if (g > maxGrade) maxGrade = g;
    if (samples[i].grade > 1) {
      upGradeSum += samples[i].grade;
      upGradeN += 1;
    }
  }

  const distanceM = samples[samples.length - 1].distanceM;
  const etaS = estimateEta(activity, distanceM, gain);

  return {
    distanceM,
    gainM: gain,
    lossM: loss,
    highM: high,
    lowM: low,
    maxGrade: samples.length > 1 ? maxGrade : null,
    avgUpGrade: upGradeN ? upGradeSum / upGradeN : null,
    etaS,
  };
}

export function statsFromLine(
  geometry: LineString,
  activity: Activity,
  elevations?: (number | null)[],
): RouteStats {
  const distanceM = lineDistance(geometry.coordinates);
  if (!elevations || elevations.length === 0) {
    return {
      distanceM,
      gainM: 0,
      lossM: 0,
      highM: null,
      lowM: null,
      maxGrade: null,
      avgUpGrade: null,
      etaS: estimateEta(activity, distanceM, 0),
    };
  }
  const samples = samplesFromElevations(geometry.coordinates, elevations);
  return statsFromSamples(samples, activity);
}

/**
 * Foot/ski: Naismith — 5 km/h plus 1 hour per 2000 ft of gain.
 * MTB: 15 km/h base plus extra time on vert.
 */
export function estimateEta(activity: Activity, distanceM: number, gainM: number): number {
  const km = distanceM / 1000;
  const gainFt = gainM / 0.3048;
  if (activity === "mtb") {
    const hours = km / 15 + gainFt / 2500;
    return Math.round(hours * 3600);
  }
  const hours = km / 5 + gainFt / 2000;
  return Math.round(hours * 3600);
}

export function pointAlong(coords: LngLat[], distanceM: number): LngLat | null {
  if (coords.length === 0) return null;
  if (distanceM <= 0) return coords[0];
  let remaining = distanceM;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(coords[i - 1], coords[i]);
    if (remaining <= d) {
      const t = d === 0 ? 0 : remaining / d;
      return interpolate(coords[i - 1], coords[i], t);
    }
    remaining -= d;
  }
  return coords[coords.length - 1];
}
