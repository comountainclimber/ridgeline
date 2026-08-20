import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { routes } from "@/lib/db/schema";
import { formatDistance, formatVert } from "@/lib/geo/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "Ridgeline";
  let stats = "";
  try {
    const db = requireDb();
    const [row] = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
    if (row) {
      name = row.name;
      stats = `${formatDistance(row.distanceM, "imperial")} · ${formatVert(row.gainM, "imperial")} vert`;
    }
  } catch {
    /* fall through */
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#07080A",
          color: "#F4F1EA",
          padding: 72,
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: 8, textTransform: "uppercase", color: "#7EB6D9" }}>
          Ridgeline
        </div>
        <div style={{ fontSize: 64, fontStyle: "italic", marginTop: 12 }}>{name}</div>
        <div style={{ fontSize: 28, color: "#C9D6E3", marginTop: 16 }}>{stats}</div>
      </div>
    ),
    size,
  );
}
