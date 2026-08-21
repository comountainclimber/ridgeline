import { describe, expect, it } from "vitest";
import { toGeocodeHits } from "./geocode";

describe("toGeocodeHits", () => {
  it("splits the short name from the rest of place_name", () => {
    const hits = toGeocodeHits([
      {
        text: "Longs Peak",
        place_name: "Longs Peak, Colorado, United States",
        center: [-105.6151, 40.2549],
        place_type: ["poi"],
      },
    ]);
    expect(hits).toEqual([
      {
        name: "Longs Peak",
        context: "Colorado, United States",
        lng: -105.6151,
        lat: 40.2549,
        kind: "poi",
      },
    ]);
  });

  it("drops features without a center", () => {
    expect(
      toGeocodeHits([{ text: "Nowhere", place_name: "Nowhere" }]),
    ).toEqual([]);
  });
});
