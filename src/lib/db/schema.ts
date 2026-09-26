import {
  index,
  jsonb,
  doublePrecision,
  integer,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ridgeline = pgSchema("ridgeline");

export const users = ridgeline.table("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  displayName: text("display_name"),
  units: text("units").notNull().default("imperial"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routes = ridgeline.table("routes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  activity: text("activity").notNull(),
  visibility: text("visibility").notNull().default("private"),
  geometry: jsonb("geometry").notNull(),
  waypoints: jsonb("waypoints").notNull().default([]),
  originalGeometry: jsonb("original_geometry"),
  distanceM: doublePrecision("distance_m").notNull().default(0),
  gainM: doublePrecision("gain_m").notNull().default(0),
  lossM: doublePrecision("loss_m").notNull().default(0),
  highM: doublePrecision("high_m"),
  lowM: doublePrecision("low_m"),
  maxGrade: doublePrecision("max_grade"),
  etaS: integer("eta_s"),
  bbox: jsonb("bbox"),
  matchConfidence: doublePrecision("match_confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("routes_owner_id_idx").on(table.ownerId),
]);

export const routeWaypoints = ridgeline.table("route_waypoints", {
  id: text("id").primaryKey(),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  lng: doublePrecision("lng").notNull(),
  lat: doublePrecision("lat").notNull(),
  label: text("label"),
  kind: text("kind").notNull().default("via"),
}, (table) => [
  index("route_waypoints_route_id_idx").on(table.routeId),
]);

export const magicLinks = ridgeline.table("magic_links", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  guestUserId: text("guest_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("magic_links_email_created_at_idx").on(table.email, table.createdAt),
  index("magic_links_guest_user_id_idx").on(table.guestUserId),
]);

export const gpxAssets = ridgeline.table("gpx_assets", {
  id: text("id").primaryKey(),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url"),
  filename: text("filename"),
  kind: text("kind").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("gpx_assets_route_id_idx").on(table.routeId),
]);
