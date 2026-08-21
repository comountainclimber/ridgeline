import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./app-url";

describe("resolveAppUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    expect(
      resolveAppUrl({ NEXT_PUBLIC_APP_URL: "https://ridgeline.highaltitude.solutions/" }),
    ).toBe("https://ridgeline.highaltitude.solutions");
  });

  it("uses the Vercel production domain in production", () => {
    expect(
      resolveAppUrl({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "ridgeline.highaltitude.solutions",
        VERCEL_URL: "ridgeline-abc.vercel.app",
      }),
    ).toBe("https://ridgeline.highaltitude.solutions");
  });

  it("ignores a localhost NEXT_PUBLIC_APP_URL on Vercel production", () => {
    expect(
      resolveAppUrl({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "ridgeline.highaltitude.solutions",
      }),
    ).toBe("https://ridgeline.highaltitude.solutions");
  });

  it("uses the deployment URL on preview", () => {
    expect(
      resolveAppUrl({
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "ridgeline.highaltitude.solutions",
        VERCEL_URL: "ridgeline-git-feat.vercel.app",
      }),
    ).toBe("https://ridgeline-git-feat.vercel.app");
  });

  it("falls back to localhost off Vercel", () => {
    expect(resolveAppUrl({})).toBe("http://localhost:3000");
  });
});
