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

export const SNAP_PROFILE: MapboxProfile = "walking";

export type MapStyleId = "outdoors" | "satellite" | "winter";

export type SavedRoute = {
  id: string;
  ownerId: string | null;
  name: string;
  description: string | null;
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
  waypoints: Waypoint[];
  geometry: LineString | null;
  originalGeometry: LineString | null;
  stats: RouteStats | null;
  samples: ElevationSample[];
  matchConfidence: number | null;
  showOriginal: boolean;
};
