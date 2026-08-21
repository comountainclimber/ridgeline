import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { planClaim, type ClaimPlan } from "@/lib/auth/claim";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { getSessionUser, setUserCookie, toSessionUser, type SessionUser } from "@/lib/auth/session";
import {
  createRawToken,
  hashToken,
  isRateLimited,
  isTokenUsable,
  MAGIC_LINK_HOURLY_CAP,
  MAGIC_LINK_TTL_MS,
  normalizeEmail,
  safeNextPath,
} from "@/lib/auth/token";
import { requireDb } from "@/lib/db";
import { magicLinks, routes, users } from "@/lib/db/schema";

export { normalizeEmail, safeNextPath };

export async function issueMagicLink(rawEmail: string, next?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "Enter a valid email." };

  const db = requireDb();
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [{ value: hourly }] = await db
    .select({ value: count() })
    .from(magicLinks)
    .where(and(eq(magicLinks.email, email), gt(magicLinks.createdAt, hourAgo)));
  if (Number(hourly) >= MAGIC_LINK_HOURLY_CAP) return { ok: true };

  const [latest] = await db
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.email, email))
    .orderBy(desc(magicLinks.createdAt))
    .limit(1);
  if (isRateLimited(latest?.createdAt ?? null, now)) return { ok: true };

  const session = await getSessionUser();
  const guestUserId = session && !session.email ? session.id : null;
  const raw = createRawToken();
  const nextPath = safeNextPath(next);
  await db.insert(magicLinks).values({
    id: nanoid(),
    email,
    tokenHash: hashToken(raw),
    expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS),
    guestUserId,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/sign-in/verify", appUrl);
  url.searchParams.set("token", raw);
  if (nextPath !== "/routes") url.searchParams.set("next", nextPath);
  await sendMagicLinkEmail({ to: email, url: url.toString() });
  return { ok: true };
}

export async function consumeMagicLink(
  rawToken: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  if (!rawToken) return { ok: false, error: "Missing sign-in link." };

  const db = requireDb();
  const tokenHash = hashToken(rawToken);
  const [row] = await db
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.tokenHash, tokenHash))
    .limit(1);
  if (!row || !isTokenUsable(row)) {
    return { ok: false, error: "That link expired or was already used." };
  }

  const [tokenGuest] = row.guestUserId
    ? await db.select().from(users).where(eq(users.id, row.guestUserId)).limit(1)
    : [];
  const session = await getSessionUser();
  const guestRef = tokenGuest
    ? { id: tokenGuest.id, email: tokenGuest.email }
    : session && !session.email
      ? { id: session.id, email: session.email }
      : null;

  const [account] = await db.select().from(users).where(eq(users.email, row.email)).limit(1);
  let plan = planClaim({
    guest: guestRef,
    account: account ? { id: account.id, email: account.email } : null,
  });

  let user: SessionUser;
  try {
    user = await applyClaim(row.email, plan);
  } catch {
    const [again] = await db.select().from(users).where(eq(users.email, row.email)).limit(1);
    if (!again) return { ok: false, error: "Could not finish sign-in." };
    plan = planClaim({
      guest: guestRef,
      account: { id: again.id, email: again.email },
    });
    user = await applyClaim(row.email, plan);
  }

  await db
    .update(magicLinks)
    .set({ consumedAt: new Date() })
    .where(and(eq(magicLinks.email, row.email), isNull(magicLinks.consumedAt)));
  await setUserCookie(user.id);
  return { ok: true, user };
}

async function applyClaim(email: string, plan: ClaimPlan): Promise<SessionUser> {
  const db = requireDb();
  const now = new Date();

  if (plan.type === "attach") {
    const [row] = await db
      .update(users)
      .set({ email, emailVerifiedAt: now })
      .where(eq(users.id, plan.userId))
      .returning();
    if (!row) throw new Error("Could not load account.");
    return toSessionUser(row);
  }

  if (plan.type === "reuse") {
    const [row] = await db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, plan.userId))
      .returning();
    if (!row) throw new Error("Could not load account.");
    return toSessionUser(row);
  }

  if (plan.type === "create") {
    const id = nanoid();
    const [row] = await db
      .insert(users)
      .values({ id, email, emailVerifiedAt: now, units: "imperial" })
      .returning();
    if (!row) throw new Error("Could not load account.");
    return toSessionUser(row);
  }

  const [guest] = await db.select().from(users).where(eq(users.id, plan.guestId)).limit(1);
  const [account] = await db.select().from(users).where(eq(users.id, plan.accountId)).limit(1);
  await db.update(routes).set({ ownerId: plan.accountId }).where(eq(routes.ownerId, plan.guestId));
  await db
    .update(users)
    .set({
      emailVerifiedAt: now,
      displayName: account?.displayName ?? guest?.displayName ?? null,
    })
    .where(eq(users.id, plan.accountId));
  await db.delete(users).where(eq(users.id, plan.guestId));
  const [row] = await db.select().from(users).where(eq(users.id, plan.accountId)).limit(1);
  if (!row) throw new Error("Could not load account.");
  return toSessionUser(row);
}
