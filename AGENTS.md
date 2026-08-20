<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ridgeline ownership

- `src/lib/geo/**`, `src/lib/mapbox/**`, `src/app/api/map/**` — snap, GPX, stats
- `src/components/map/**` — Mapbox GL canvas
- `src/components/planner/**`, `src/app/plan/**` — planner HUD
- `src/components/brand/**`, `src/app/page.tsx`, `src/app/globals.css` — brand + landing
- `src/lib/db/**`, `src/lib/auth/**`, `src/app/api/routes/**`, `src/app/routes/**`, `src/app/r/**`, `src/app/explore/**` — library + auth
- `src/lib/seed/**` — editorial picks

