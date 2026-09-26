# Ridgeline

Mapping for mountain athletes. Plan a line, snap it to real trails and roads, read vert and miles, export GPX.

## Stack

Next.js · Vercel · a dedicated Neon database (schema `ridgeline`) · Mapbox

## Local

```bash
cp .env.example .env.local
# add NEXT_PUBLIC_MAPBOX_TOKEN, MAPBOX_SECRET_TOKEN, DATABASE_URL
# add RESEND_API_KEY (and RESEND_FROM_EMAIL once the sending domain is verified)
# production: NEXT_PUBLIC_APP_URL=https://ridgeline.highaltitude.solutions (magic-link emails)
npm install
npm run dev
```

`DATABASE_URL` must be Ridgeline's own database. Apply [`schema.sql`](schema.sql) to that empty database before `npm run db:push`. Do not point this app at the Whetstone database.

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run db:seed
```

Never commit `.env.local`. The Mapbox secret token is server-only.
Without `RESEND_API_KEY`, sign-in links print to the terminal in development.
