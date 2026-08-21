import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { directionsAlong } from "../mapbox/client";
import type { LineString } from "../geo/types";
import { SNAP_PROFILE } from "../geo/types";
import { statsWithElevation } from "../geo/elevation";
import { DEFAULT_ROUTE_ACTIVITY, makeWaypoint, relabelWaypoints, routeBbox } from "../geo/helpers";

function asLineString(value: unknown): LineString | null {
  if (!value || typeof value !== "object") return null;
  const g = value as LineString;
  if (g.type !== "LineString" || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
    return null;
  }
  return g;
}

const SEEDS: {
  name: string;
  description: string;
  points: { lng: number; lat: number }[];
}[] = [
  {
    name: "Aiguilles Rouges traverse",
    description: "Chamonix valley alpine hiking.",
    points: [
      { lng: 6.8694, lat: 45.9237 },
      { lng: 6.8875, lat: 45.9672 },
    ],
  },
  {
    name: "Half Dome cables approach",
    description: "Yosemite granite classic.",
    points: [
      { lng: -119.559, lat: 37.7326 },
      { lng: -119.5332, lat: 37.745 },
    ],
  },
  {
    name: "Tour du Mont Blanc · Les Houches",
    description: "A TMB stage out of the valley.",
    points: [
      { lng: 6.8694, lat: 45.9237 },
      { lng: 6.798, lat: 45.89 },
    ],
  },
  {
    name: "Whistler Fitzsimmons",
    description: "Bike park access roads and valley trail.",
    points: [
      { lng: -122.954, lat: 50.1163 },
      { lng: -122.946, lat: 50.135 },
    ],
  },
  {
    name: "Kilimanjaro crater rim",
    description: "High camp to Uhuru approach.",
    points: [
      { lng: 37.355, lat: -3.076 },
      { lng: 37.353, lat: -3.0674 },
    ],
  },
  {
    name: "Grays Peak approach",
    description: "Colorado 14er from Stevens Gulch.",
    points: [
      { lng: -105.784, lat: 39.6606 },
      { lng: -105.8172, lat: 39.6336 },
    ],
  },
  {
    name: "Tahoe Rim · Brockway",
    description: "High Sierra winter path network.",
    points: [
      { lng: -120.231, lat: 39.225 },
      { lng: -120.21, lat: 39.258 },
    ],
  },
  {
    name: "Tre Cime circuit",
    description: "Dolomites limestone horseshoe.",
    points: [
      { lng: 12.303, lat: 46.618 },
      { lng: 12.319, lat: 46.637 },
    ],
  },
  {
    name: "Haute Route snippet · Argentière",
    description: "A taste of the Chamonix–Zermatt line.",
    points: [
      { lng: 6.927, lat: 45.984 },
      { lng: 6.98, lat: 45.996 },
    ],
  },
  {
    name: "JMT taste · Whitney Portal",
    description: "The granite start of a longer walk.",
    points: [
      { lng: -118.237, lat: 36.586 },
      { lng: -118.241, lat: 36.578 },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const db = drizzle(neon(url), { schema });

  for (const seed of SEEDS) {
    try {
      const [existing] = await db
        .select()
        .from(schema.routes)
        .where(
          and(
            eq(schema.routes.name, seed.name),
            eq(schema.routes.visibility, "public"),
            isNull(schema.routes.ownerId),
          ),
        )
        .limit(1);

      if (existing && existing.gainM > 0) {
        console.log("ok", seed.name, Math.round(existing.distanceM), "m", Math.round(existing.gainM), "m gain");
        continue;
      }

      const geometry =
        asLineString(existing?.geometry) ??
        (await directionsAlong(
          seed.points.map((p) => [p.lng, p.lat]),
          SNAP_PROFILE,
        ));
      const stats = await statsWithElevation(geometry, { retries: 5 });
      const statsCols = {
        distanceM: stats.distanceM,
        gainM: stats.gainM,
        lossM: stats.lossM,
        highM: stats.highM,
        lowM: stats.lowM,
        maxGrade: stats.maxGrade,
        etaS: stats.etaS,
      };

      if (existing) {
        await db
          .update(schema.routes)
          .set({ ...statsCols, updatedAt: new Date() })
          .where(eq(schema.routes.id, existing.id));
        console.log("updated", seed.name, Math.round(stats.distanceM), "m", Math.round(stats.gainM), "m gain");
        continue;
      }

      const waypoints = relabelWaypoints(
        seed.points.map((p, i) =>
          makeWaypoint(p.lng, p.lat, i === 0 ? "start" : i === seed.points.length - 1 ? "end" : "via"),
        ),
      );
      await db.insert(schema.routes).values({
        id: nanoid(),
        ownerId: null,
        name: seed.name,
        description: seed.description,
        activity: DEFAULT_ROUTE_ACTIVITY,
        visibility: "public",
        geometry,
        waypoints,
        ...statsCols,
        bbox: routeBbox(geometry),
      });
      console.log("seeded", seed.name, Math.round(stats.distanceM), "m", Math.round(stats.gainM), "m gain");
    } catch (err) {
      console.warn("skip", seed.name, err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
