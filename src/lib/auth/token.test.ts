import { describe, expect, it } from "vitest";
import {
  createRawToken,
  hashToken,
  isRateLimited,
  isTokenUsable,
  MAGIC_LINK_RATE_LIMIT_MS,
  normalizeEmail,
  safeNextPath,
} from "./token";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Max@Example.COM ")).toBe("max@example.com");
  });

  it("rejects junk", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});

describe("hashToken", () => {
  it("is deterministic and not reversible", () => {
    const raw = createRawToken();
    expect(raw).not.toContain("=");
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(raw);
    expect(hashToken(raw)).not.toBe(hashToken(raw + "x"));
  });
});

describe("isTokenUsable", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("accepts a live unused token", () => {
    expect(
      isTokenUsable({ expiresAt: new Date("2026-08-20T12:15:00Z"), consumedAt: null }, now),
    ).toBe(true);
  });

  it("rejects expired tokens", () => {
    expect(
      isTokenUsable({ expiresAt: new Date("2026-08-20T11:59:00Z"), consumedAt: null }, now),
    ).toBe(false);
  });

  it("rejects consumed tokens", () => {
    expect(
      isTokenUsable(
        { expiresAt: new Date("2026-08-20T12:15:00Z"), consumedAt: new Date("2026-08-20T11:50:00Z") },
        now,
      ),
    ).toBe(false);
  });
});

describe("isRateLimited", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("allows a first send", () => {
    expect(isRateLimited(null, now)).toBe(false);
  });

  it("blocks inside the window", () => {
    expect(isRateLimited(new Date("2026-08-20T11:59:30Z"), now)).toBe(true);
  });

  it("allows after the window", () => {
    expect(
      isRateLimited(new Date(now.getTime() - MAGIC_LINK_RATE_LIMIT_MS), now),
    ).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows in-app paths", () => {
    expect(safeNextPath("/plan")).toBe("/plan");
    expect(safeNextPath("/routes/abc")).toBe("/routes/abc");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.test")).toBe("/routes");
    expect(safeNextPath("//evil.test")).toBe("/routes");
    expect(safeNextPath("\\evil")).toBe("/routes");
    expect(safeNextPath(null)).toBe("/routes");
  });
});
