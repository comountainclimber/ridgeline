import type { ElevationSample, LineString, LngLat, RouteStats } from "./types";

const EARTH_M = 6371000;
/** DEM cells are ~30–90 m; ignore smaller wiggles so noise does not become vert. */
const DEADBAND_M = 10;
/** Space samples near DEM resolution instead of interpolating extra wiggles. */
export const ELEVATION_SAMPLE_M = 80;
export const ELEVATION_MAX_SAMPLES = 100;
const SMOOTH_RADIUS = 2;
/** One-sample spikes steeper than this vs both neighbors are DEM glitches, not trail. */
const SPIKE_GRADE = 0.8;
const SPIKE_THROUGH_GRADE = 0.3;

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
export function densify(coords: LngLat[], everyM = ELEVATION_SAMPLE_M): LngLat[] {
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

export function elevationSampleIndices(length: number, maxSamples = ELEVATION_MAX_SAMPLES): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  const n = Math.min(length, maxSamples);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    idx.push(Math.round((i / (n - 1)) * (length - 1)));
  }
  return idx;
}

/** Fill every vertex by linearly interpolating sparse DEM samples. */
export function interpolateElevationsAlong(
  length: number,
  sampleIdx: number[],
  sampled: (number | null)[],
): (number | null)[] {
  if (length === 0) return [];
  if (sampleIdx.length === 0) return Array.from({ length }, () => null);
  const out: (number | null)[] = [];
  let k = 0;
  for (let i = 0; i < length; i++) {
    while (k < sampleIdx.length - 2 && sampleIdx[k + 1] < i) k += 1;
    const i0 = sampleIdx[k];
    const i1 = sampleIdx[Math.min(k + 1, sampleIdx.length - 1)];
    const e0 = sampled[k];
    const e1 = sampled[Math.min(k + 1, sampled.length - 1)];
    const e0Ok = e0 != null && Number.isFinite(e0);
    const e1Ok = e1 != null && Number.isFinite(e1);
    if (!e0Ok) {
      out.push(e1Ok ? e1 : null);
      continue;
    }
    if (i1 === i0 || !e1Ok) {
      out.push(e0);
      continue;
    }
    const t = (i - i0) / (i1 - i0);
    out.push(e0 + (e1 - e0) * t);
  }
  return out;
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

function recomputeGrades(samples: ElevationSample[]): ElevationSample[] {
  return samples.map((s, i) => {
    if (i === 0) return { ...s, grade: 0 };
    const run = s.distanceM - samples[i - 1].distanceM;
    const grade = run > 0.5 ? ((s.elevationM - samples[i - 1].elevationM) / run) * 100 : 0;
    return { ...s, grade };
  });
}

export function rejectElevationSpikes(samples: ElevationSample[]): ElevationSample[] {
  if (samples.length < 3) return samples;
  const bad = samples.map(() => false);
  for (let i = 1; i < samples.length - 1; i++) {
    const dL = samples[i].distanceM - samples[i - 1].distanceM;
    const dR = samples[i + 1].distanceM - samples[i].distanceM;
    const through = samples[i + 1].distanceM - samples[i - 1].distanceM;
    if (dL <= 0.5 || dR <= 0.5 || through <= 0.5) continue;
    const gL = Math.abs(samples[i].elevationM - samples[i - 1].elevationM) / dL;
    const gR = Math.abs(samples[i + 1].elevationM - samples[i].elevationM) / dR;
    const gThrough = Math.abs(samples[i + 1].elevationM - samples[i - 1].elevationM) / through;
    if (gL > SPIKE_GRADE && gR > SPIKE_GRADE && gThrough < SPIKE_THROUGH_GRADE) {
      bad[i] = true;
    }
  }
  if (!bad.some(Boolean)) return samples;
  const next = samples.map((s, i) => {
    if (!bad[i]) return s;
    let L = i - 1;
    let R = i + 1;
    while (L >= 0 && bad[L]) L -= 1;
    while (R < samples.length && bad[R]) R += 1;
    if (L < 0 && R >= samples.length) return s;
    if (L < 0) return { ...s, elevationM: samples[R].elevationM };
    if (R >= samples.length) return { ...s, elevationM: samples[L].elevationM };
    const span = samples[R].distanceM - samples[L].distanceM;
    const t = span > 0 ? (s.distanceM - samples[L].distanceM) / span : 0;
    return {
      ...s,
      elevationM: samples[L].elevationM + (samples[R].elevationM - samples[L].elevationM) * t,
    };
  });
  return recomputeGrades(next);
}

export function smoothElevationSamples(samples: ElevationSample[]): ElevationSample[] {
  if (samples.length < 3) return samples;
  const n = samples.length;
  const next = samples.map((s, i) => {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - SMOOTH_RADIUS);
    const hi = Math.min(n - 1, i + SMOOTH_RADIUS);
    for (let j = lo; j <= hi; j++) {
      sum += samples[j].elevationM;
      count += 1;
    }
    return { ...s, elevationM: sum / count };
  });
  return recomputeGrades(next);
}

export function prepareElevationSamples(
  points: LngLat[],
  elevations: (number | null)[],
): ElevationSample[] {
  return smoothElevationSamples(rejectElevationSpikes(samplesFromElevations(points, elevations)));
}

export function statsFromSamples(samples: ElevationSample[]): RouteStats {
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
    // Hysteresis: last only moves after a real 10 m change. Leftover under
    // the threshold is DEM noise, not vert.
    if (d >= DEADBAND_M) {
      gain += d;
      last = ele;
    } else if (d <= -DEADBAND_M) {
      loss -= d;
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
  const etaS = estimateEta(distanceM, gain);

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
      etaS: estimateEta(distanceM, 0),
    };
  }
  const samples = prepareElevationSamples(geometry.coordinates, elevations);
  return statsFromSamples(samples);
}

/** Naismith — 5 km/h plus 1 hour per 2000 ft of gain. */
export function estimateEta(distanceM: number, gainM: number): number {
  const km = distanceM / 1000;
  const gainFt = gainM / 0.3048;
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
