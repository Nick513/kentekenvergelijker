import { describe, expect, it } from "vitest";
import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import type { EnrichedSpecMap } from "@/lib/enrichment/types";
import { cellIsUnverifiedForDisplay, rowHasUnverifiedValues } from "@/lib/specifications/resolve";

function specMap(
  entries: Array<[string, Partial<import("@/lib/enrichment/types").EnrichedSpecValue>]>,
): EnrichedSpecMap {
  const map: EnrichedSpecMap = new Map();
  for (const [key, value] of entries) {
    map.set(key, {
      valueText: null,
      valueNumeric: null,
      valueBoolean: true,
      verification: "trim_inferred",
      source: "catalog",
      listingUrl: null,
      ...value,
    });
  }
  return map;
}

describe("mergeEnrichedSpecs", () => {
  it("prefers listing_claim over trim_inferred for the same spec", () => {
    const listing = specMap([
      ["lane_assist", { verification: "listing_claim", source: "listing_gaspedaal" }],
    ]);
    const catalog = specMap([
      ["lane_assist", { verification: "trim_inferred", valueBoolean: false }],
    ]);

    const merged = mergeEnrichedSpecs(listing, catalog);
    expect(merged.get("lane_assist")?.verification).toBe("listing_claim");
  });

  it("prefers listing_claim_structured over listing_claim for the same spec", () => {
    const structured = specMap([
      ["adaptive_cruise_control", { verification: "listing_claim_structured", valueBoolean: false, source: "listing_autoscout24" }],
    ]);
    const text = specMap([
      ["adaptive_cruise_control", { verification: "listing_claim", valueBoolean: true, source: "listing_gaspedaal" }],
    ]);

    const merged = mergeEnrichedSpecs(structured, text);
    expect(merged.get("adaptive_cruise_control")?.valueBoolean).toBe(false);
    expect(merged.get("adaptive_cruise_control")?.verification).toBe("listing_claim_structured");
  });

  it("prefers listing_claim_structured over trim_inferred and can set false", () => {
    const structured = specMap([
      ["adaptive_cruise_control", { verification: "listing_claim_structured", valueBoolean: false, source: "listing_autoscout24" }],
    ]);
    const catalog = specMap([
      ["adaptive_cruise_control", { verification: "trim_inferred", valueBoolean: true }],
    ]);

    const merged = mergeEnrichedSpecs(structured, catalog);
    expect(merged.get("adaptive_cruise_control")?.valueBoolean).toBe(false);
  });

  it("keeps catalog specs when listing has no claim", () => {
    const catalog = specMap([["navigation", { verification: "trim_inferred" }]]);
    const merged = mergeEnrichedSpecs(new Map(), catalog);
    expect(merged.get("navigation")?.verification).toBe("trim_inferred");
  });
});

describe("cellIsUnverifiedForDisplay", () => {
  it("flags trim_inferred boolean cells", () => {
    expect(
      cellIsUnverifiedForDisplay({ value: true, verification: "trim_inferred" }),
    ).toBe(true);
  });

  it("does not flag listing_claim cells", () => {
    expect(
      cellIsUnverifiedForDisplay({ value: true, verification: "listing_claim" }),
    ).toBe(false);
  });

  it("does not flag listing_claim_structured cells", () => {
    expect(
      cellIsUnverifiedForDisplay({ value: true, verification: "listing_claim_structured" }),
    ).toBe(false);
  });

  it("ignores unavailable and false cells", () => {
    expect(
      cellIsUnverifiedForDisplay({ value: "-", verification: "trim_inferred" }),
    ).toBe(false);
    expect(
      cellIsUnverifiedForDisplay({ value: false, verification: "trim_inferred" }),
    ).toBe(false);
  });
});

describe("rowHasUnverifiedValues", () => {
  it("is true when any cell is unverified", () => {
    expect(
      rowHasUnverifiedValues({
        values: [
          { value: "Handgeschakeld", verification: "verified" },
          { value: "Automaat", verification: "trim_inferred" },
        ],
      }),
    ).toBe(true);
  });

  it("is false when all cells are verified or absent", () => {
    expect(
      rowHasUnverifiedValues({
        values: [
          { value: "-", verification: "trim_inferred" },
          { value: false, verification: "trim_inferred" },
        ],
      }),
    ).toBe(false);
  });
});
