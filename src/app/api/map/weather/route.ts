import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 502 });
  }
  const json = (await res.json()) as {
    current?: { temperature_2m?: number; wind_speed_10m?: number; weather_code?: number };
  };
  return NextResponse.json({
    tempF: json.current?.temperature_2m ?? null,
    windMph: json.current?.wind_speed_10m ?? null,
    code: json.current?.weather_code ?? null,
  });
}
