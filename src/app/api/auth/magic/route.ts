import { NextRequest, NextResponse } from "next/server";
import { issueMagicLink } from "@/lib/auth/magic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const next = typeof body.next === "string" ? body.next : undefined;
  const result = await issueMagicLink(email, next);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
