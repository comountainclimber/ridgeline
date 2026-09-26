-- Ridgeline schema for a dedicated database.
-- Compared with the shared Whetstone database on 2026-09-26: table, column,
-- nullability, default, primary key, unique, and foreign-key definitions match.
-- The shared database had no functions, triggers, or secondary indexes.
-- The indexes below were missing there and are included so a new database
-- can serve the route and magic-link lookups the application already runs.
-- This file creates no rows.

CREATE SCHEMA IF NOT EXISTS ridgeline;

CREATE TABLE ridgeline.users (
  id text PRIMARY KEY,
  email text,
  email_verified_at timestamptz,
  display_name text,
  units text NOT NULL DEFAULT 'imperial',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE ridgeline.routes (
  id text PRIMARY KEY,
  owner_id text REFERENCES ridgeline.users (id),
  name text NOT NULL,
  description text,
  activity text NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  geometry jsonb NOT NULL,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_geometry jsonb,
  distance_m double precision NOT NULL DEFAULT 0,
  gain_m double precision NOT NULL DEFAULT 0,
  loss_m double precision NOT NULL DEFAULT 0,
  high_m double precision,
  low_m double precision,
  max_grade double precision,
  eta_s integer,
  bbox jsonb,
  match_confidence double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX routes_owner_id_idx ON ridgeline.routes (owner_id);

CREATE TABLE ridgeline.route_waypoints (
  id text PRIMARY KEY,
  route_id text NOT NULL REFERENCES ridgeline.routes (id) ON DELETE CASCADE,
  seq integer NOT NULL,
  lng double precision NOT NULL,
  lat double precision NOT NULL,
  label text,
  kind text NOT NULL DEFAULT 'via'
);

CREATE INDEX route_waypoints_route_id_idx ON ridgeline.route_waypoints (route_id);

CREATE TABLE ridgeline.magic_links (
  id text PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  guest_user_id text REFERENCES ridgeline.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT magic_links_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX magic_links_email_created_at_idx ON ridgeline.magic_links (email, created_at);
CREATE INDEX magic_links_guest_user_id_idx ON ridgeline.magic_links (guest_user_id);

CREATE TABLE ridgeline.gpx_assets (
  id text PRIMARY KEY,
  route_id text NOT NULL REFERENCES ridgeline.routes (id) ON DELETE CASCADE,
  blob_url text,
  filename text,
  kind text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gpx_assets_route_id_idx ON ridgeline.gpx_assets (route_id);
