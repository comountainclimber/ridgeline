import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchElevations } from "./elevation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchElevations", () => {
  it("returns an empty list for no coordinates", async () => {
    expect(await fetchElevations([])).toEqual([]);
  });

  it("interpolates DEM samples onto every vertex", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ elevation: [100, 200, 100] }), { status: 200 })),
    );
    const out = await fetchElevations([
      [0, 0],
      [0.001, 0],
      [0.002, 0],
    ]);
    expect(out).toEqual([100, 200, 100]);
  });

  it("throws when the DEM request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(fetchElevations([[0, 0]])).rejects.toThrow("Elevation unavailable");
  });

  it("retries after a 429 then returns elevations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ elevation: [10] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchElevations([[0, 0]], { retries: 1, retryDelayMs: 0 })).resolves.toEqual([10]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
