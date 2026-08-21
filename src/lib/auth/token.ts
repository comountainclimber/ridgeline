import { createHash, randomBytes } from "node:crypto";

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const MAGIC_LINK_RATE_LIMIT_MS = 60 * 1000;
export const MAGIC_LINK_HOURLY_CAP = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function isTokenUsable(
  row: { expiresAt: Date; consumedAt: Date | null },
  now = new Date(),
): boolean {
  if (row.consumedAt) return false;
  return row.expiresAt.getTime() > now.getTime();
}

export function isRateLimited(
  lastSentAt: Date | null,
  now = new Date(),
  windowMs = MAGIC_LINK_RATE_LIMIT_MS,
): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - lastSentAt.getTime() < windowMs;
}

export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return "/routes";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/routes";
  if (raw.includes("://") || raw.includes("\\")) return "/routes";
  return raw.slice(0, 200);
}
