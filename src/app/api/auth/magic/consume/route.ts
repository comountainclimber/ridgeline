import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, safeNextPath } from "@/lib/auth/magic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const result = await consumeMagicLink(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ user: result.user, next: safeNextPath(body.next) });
}
