export type GeocodeHit = {
  name: string;
  context: string;
  lng: number;
  lat: number;
  kind: string;
};

export type GeocodeFeature = {
  text?: string;
  place_name?: string;
  center?: [number, number];
  place_type?: string[];
};

export function toGeocodeHits(features: GeocodeFeature[] | undefined): GeocodeHit[] {
  return (features ?? [])
    .filter((f): f is GeocodeFeature & { center: [number, number] } => {
      return Array.isArray(f.center) && f.center.length >= 2;
    })
    .map((f) => {
      const name = f.text?.trim() || f.place_name?.split(",")[0]?.trim() || "Place";
      const full = f.place_name?.trim() ?? "";
      const context = full.toLowerCase().startsWith(name.toLowerCase())
        ? full.slice(name.length).replace(/^[,\s]+/, "")
        : full === name
          ? ""
          : full;
      return {
        name,
        context,
        lng: f.center[0],
        lat: f.center[1],
        kind: f.place_type?.[0] ?? "place",
      };
    });
}
