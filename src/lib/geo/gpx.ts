import type { Activity, LineString, LngLat } from "./types";

export function toGpx(opts: {
  name: string;
  activity: Activity;
  coordinates: LngLat[];
  elevations?: (number | null)[];
}): string {
  const type =
    opts.activity === "mtb"
      ? "Cycling"
      : opts.activity === "ski"
        ? "Skiing"
        : opts.activity === "run"
          ? "Running"
          : "Hiking";
  const pts = opts.coordinates
    .map((c, i) => {
      const ele = opts.elevations?.[i];
      const eleTag =
        ele != null && Number.isFinite(ele) ? `<ele>${ele.toFixed(1)}</ele>` : "";
      return `<trkpt lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ridgeline" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(opts.name)}</name>
    <desc>Planned on Ridgeline</desc>
  </metadata>
  <trk>
    <name>${escapeXml(opts.name)}</name>
    <type>${type}</type>
    <trkseg>${pts}</trkseg>
  </trk>
</gpx>`;
}

export function parseGpxServer(xmlText: string): {
  geometry: LineString;
  name: string | null;
} {
  const nameMatch = xmlText.match(/<name>([^<]+)<\/name>/i);
  const name = nameMatch?.[1] ?? null;
  const coords: LngLat[] = [];
  const re =
    /<trkpt\s+[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"|<trkpt\s+[^>]*lon="([^"]+)"[^>]*lat="([^"]+)"|<rtept\s+[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xmlText))) {
    const lat = parseFloat(m[1] ?? m[4] ?? m[5]);
    const lng = parseFloat(m[2] ?? m[3] ?? m[6]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push([lng, lat]);
  }
  if (coords.length < 2) {
    throw new Error("No track or route found in that GPX file.");
  }
  return { geometry: { type: "LineString", coordinates: coords }, name };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
