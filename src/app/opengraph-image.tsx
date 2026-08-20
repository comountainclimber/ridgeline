import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
        <div style={{ fontSize: 28, letterSpacing: 8, textTransform: "uppercase", color: "#7EB6D9" }}>
          Ridgeline
        </div>
        <div style={{ fontSize: 72, fontStyle: "italic", marginTop: 12 }}>
          Plan a line. Snap to the mountain.
        </div>
      </div>
    ),
    size,
  );
}
