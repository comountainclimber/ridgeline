import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { directionsAlong } from "../mapbox/client";
import { ACTIVITY_META, type Activity } from "../geo/types";
import { lineDistance } from "../geo/stats";
import { estimateEta } from "../geo/stats";
import { makeWaypoint, relabelWaypoints, routeBbox } from "../geo/helpers";

const SEEDS: {
  name: string;
  description: string;
  activity: Activity;
  points: { lng: number; lat: number }[];
}[] = [
  {
    name: "Aiguilles Rouges traverse",
    description: "Chamonix valley alpine hiking.",
    activity: "hike",
    points: [
      { lng: 6.8694, lat: 45.9237 },
      { lng: 6.8875, lat: 45.9672 },
    ],
  },
  {
    name: "Half Dome cables approach",
    description: "Yosemite granite classic.",
    activity: "hike",
    points: [
      { lng: -119.559, lat: 37.7326 },
      { lng: -119.5332, lat: 37.745 },
    ],
  },
  {
    name: "Tour du Mont Blanc · Les Houches",
    description: "A TMB stage out of the valley.",
    activity: "run",
    points: [
      { lng: 6.8694, lat: 45.9237 },
      { lng: 6.798, lat: 45.89 },
    ],
  },
  {
    name: "Whistler Fitzsimmons",
    description: "Bike park access roads and valley trail.",
    activity: "mtb",
    points: [
      { lng: -122.954, lat: 50.1163 },
      { lng: -122.946, lat: 50.135 },
    ],
  },
  {
    name: "Kilimanjaro crater rim",
    description: "High camp to Uhuru approach.",
    activity: "hike",
    points: [
      { lng: 37.355, lat: -3.076 },
      { lng: 37.353, lat: -3.0674 },
    ],
  },
  {
    name: "Grays Peak approach",
    description: "Colorado 14er from Stevens Gulch.",
    activity: "hike",
    points: [
      { lng: -105.784, lat: 39.6606 },
      { lng: -105.8172, lat: 39.6336 },
    ],
  },
  {
    name: "Tahoe Rim · Brockway",
    description: "High Sierra winter path network.",
    activity: "ski",
    points: [
      { lng: -120.231, lat: 39.225 },
      { lng: -120.21, lat: 39.258 },
    ],
  },
  {
    name: "Tre Cime circuit",
    description: "Dolomites limestone horseshoe.",
    activity: "run",
    points: [
      { lng: 12.303, lat: 46.618 },
      { lng: 12.319, lat: 46.637 },
    ],
  },
  {
    name: "Haute Route snippet · Argentière",
    description: "A taste of the Chamonix–Zermatt line.",
    activity: "ski",
    points: [
      { lng: 6.927, lat: 45.984 },
      { lng: 6.98, lat: 45.996 },
    ],
  },
  {
    name: "JMT taste · Whitney Portal",
    description: "The granite start of a longer walk.",
    activity: "hike",
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

  const existing = await db.select({ id: schema.routes.id }).from(schema.routes).where(eq(schema.routes.visibility, "public"));
  console.log(`public routes already: ${existing.length}`);

  for (const seed of SEEDS) {
    try {
      const geometry = await directionsAlong(
        seed.points.map((p) => [p.lng, p.lat]),
        ACTIVITY_META[seed.activity].profile,
      );
      const distanceM = lineDistance(geometry.coordinates);
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
        activity: seed.activity,
        visibility: "public",
        geometry,
        waypoints,
        distanceM,
        gainM: 0,
        lossM: 0,
        etaS: estimateEta(seed.activity, distanceM, 0),
        bbox: routeBbox(geometry),
      });
      console.log("seeded", seed.name, Math.round(distanceM), "m");
    } catch (err) {
      console.warn("skip", seed.name, err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
