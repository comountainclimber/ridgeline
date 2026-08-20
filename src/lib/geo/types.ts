export const ACTIVITIES = ["run", "hike", "ski", "mtb"] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const UNITS = ["imperial", "metric"] as const;
export type Units = (typeof UNITS)[number];

export const VISIBILITIES = ["private", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export type LngLat = [number, number];

export type WaypointKind = "start" | "via" | "end";

export type Waypoint = {
  id: string;
  lng: number;
  lat: number;
  label?: string;
  kind: WaypointKind;
};

export type LineString = {
  type: "LineString";
  coordinates: LngLat[];
};

export type RouteStats = {
  distanceM: number;
  gainM: number;
  lossM: number;
  highM: number | null;
  lowM: number | null;
  maxGrade: number | null;
  avgUpGrade: number | null;
  etaS: number;
};

export type ElevationSample = {
  distanceM: number;
  elevationM: number;
  grade: number;
  lng: number;
  lat: number;
};

export type SnappedRoute = {
  geometry: LineString;
  originalGeometry?: LineString;
  waypoints: Waypoint[];
  stats: RouteStats;
  matchConfidence: number | null;
  profile: MapboxProfile;
};

export type MapboxProfile = "walking" | "cycling";

export type MapStyleId = "outdoors" | "satellite" | "winter";

export const ACTIVITY_META: Record<
  Activity,
  { label: string; profile: MapboxProfile; color: string; glow: string; hint: string }
> = {
  run: {
    label: "Trail run",
    profile: "walking",
    color: "#E85D3A",
    glow: "rgba(232, 93, 58, 0.45)",
    hint: "Snaps to footpaths and trails",
  },
  hike: {
    label: "Hike",
    profile: "walking",
    color: "#C9D6E3",
    glow: "rgba(201, 214, 227, 0.4)",
    hint: "Snaps to hiking paths and approaches",
  },
  ski: {
    label: "Ski / split",
    profile: "walking",
    color: "#7EB6D9",
    glow: "rgba(126, 182, 217, 0.45)",
    hint: "Snaps to the path network — not a ski-piste graph",
  },
  mtb: {
    label: "MTB",
    profile: "cycling",
    color: "#8BAF7A",
    glow: "rgba(139, 175, 122, 0.45)",
    hint: "Snaps to bikeable trails and fire roads",
  },
};

export type SavedRoute = {
  id: string;
  ownerId: string | null;
  name: string;
  description: string | null;
  activity: Activity;
  visibility: Visibility;
  geometry: LineString;
  originalGeometry: LineString | null;
  waypoints: Waypoint[];
  stats: RouteStats;
  matchConfidence: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PlannerDraft = {
  name: string;
  activity: Activity;
  waypoints: Waypoint[];
  geometry: LineString | null;
  originalGeometry: LineString | null;
  stats: RouteStats | null;
  samples: ElevationSample[];
  matchConfidence: number | null;
  showOriginal: boolean;
};
