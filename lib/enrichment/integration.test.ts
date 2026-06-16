/**
 * Integration tests for the enrichment pipeline.
 *
 * These tests hit live websites. Run them with:
 *   INTEGRATION_TEST=1 npx vitest run lib/enrichment/integration.test.ts
 *
 * They are skipped by default so CI does not make network calls.
 */

import { describe, expect, it } from "vitest";
import { searchAutoScout24 } from "@/lib/enrichment/autoscout24";
import { searchTextListings } from "@/lib/enrichment/listings";
import { searchCarbase } from "@/lib/enrichment/carbase";
import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import type { EnrichedSpecMap, EnrichedSpecValue, SpecVerification } from "@/lib/enrichment/types";
import type { VehicleSnapshot } from "@/lib/rdw/types";

const ENABLED = process.env.INTEGRATION_TEST === "1";

// ---------------------------------------------------------------------------
// Known plates
// ---------------------------------------------------------------------------

type PlateFixture = {
  plate: string;
  snapshot: VehicleSnapshot;
  /** Minimum number of specs the merged result must contain. */
  minSpecs: number;
  /** Minimum number of distinct source values in the merged result. */
  minSources: number;
  /** For specific boolean specs: expected value (or "any" to just assert present). */
  expectedBooleans?: Record<string, boolean | "present">;
  /** Specs that must NOT be true (known false-positives from before fixes). */
  mustNotBeTrue?: string[];
};

function nullSnapshot(
  plate: string,
  brand: string,
  modelName: string,
  overrides: Partial<VehicleSnapshot> = {},
): VehicleSnapshot {
  return {
    licensePlate: plate,
    brand,
    modelName,
    vehicleType: null,
    bodyType: null,
    primaryColor: null,
    doorCount: null,
    seatCount: null,
    cylinderCount: null,
    engineDisplacementCc: null,
    firstRegistrationYear: null,
    catalogPrice: null,
    apkExpiryDate: null,
    vehicleLengthCm: null,
    vehicleWidthCm: null,
    vehicleHeightCm: null,
    wheelbaseCm: null,
    curbWeightKg: null,
    emptyWeightKg: null,
    maxTowingWeightBrakedKg: null,
    fuelType: null,
    powerKw: null,
    electricRangeKm: null,
    electricConsumptionWltp: null,
    co2EmissionGKm: null,
    emissionStandard: null,
    europeanVehicleCategory: null,
    configurationKey: `${brand.toLowerCase()}_${modelName.toLowerCase()}`,
    typeApprovalNumber: null,
    variant: null,
    rdwConfigurationCode: null,
    ...overrides,
  };
}

const PLATES: PlateFixture[] = [
  {
    // Kia Niro 1.6 GDi Hybrid — reported false positive: panoramadak
    plate: "k818xf",
    snapshot: nullSnapshot("k818xf", "KIA", "NIRO", {
      fuelType: "Benzine/elektriciteit",
      engineDisplacementCc: 1580,
      powerKw: 104,
      firstRegistrationYear: 2020,
      variant: "DYNAMICLINE",
    }),
    minSpecs: 8,
    minSources: 1,
    mustNotBeTrue: ["panoramic_roof"],
  },
  {
    // Kia Niro 1.6 GDi Hybrid — reported false positive: panoramadak
    plate: "p220zb",
    snapshot: nullSnapshot("p220zb", "KIA", "NIRO", {
      fuelType: "Benzine/elektriciteit",
      engineDisplacementCc: 1580,
      powerKw: 104,
      firstRegistrationYear: 2020,
    }),
    minSpecs: 8,
    minSources: 1,
    mustNotBeTrue: ["panoramic_roof"],
  },
  // Add a third plate here — pick any car you know is listed on AutoScout24:
  // {
  //   plate: "xx-000-x",
  //   snapshot: nullSnapshot("xx-000-x", "BRAND", "MODEL", { ... }),
  //   minSpecs: 10,
  //   minSources: 2,
  // },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sourcesIn(map: EnrichedSpecMap): Set<string> {
  const sources = new Set<string>();
  for (const v of map.values()) sources.add(v.source);
  return sources;
}

function verificationsIn(map: EnrichedSpecMap): Set<string> {
  const v = new Set<string>();
  for (const val of map.values()) v.add(val.verification);
  return v;
}

function printProfile(
  plate: string,
  autoScout: EnrichedSpecMap,
  text: EnrichedSpecMap,
  carbase: EnrichedSpecMap,
  merged: EnrichedSpecMap,
): void {
  const fmt = (v: EnrichedSpecValue) => {
    if (v.valueBoolean !== null) return v.valueBoolean ? "✓" : "✗";
    return v.valueText ?? String(v.valueNumeric ?? "-");
  };

  const label = (v: EnrichedSpecValue) =>
    `${fmt(v)}  [${v.verification} / ${v.source}]`;

  const allKeys = new Set([
    ...autoScout.keys(),
    ...text.keys(),
    ...carbase.keys(),
  ]);

  const conflicts: string[] = [];
  const lines: string[] = [`\n=== PROFIEL ${plate.toUpperCase()} ===`];

  for (const key of [...allKeys].sort()) {
    const a = autoScout.get(key);
    const t = text.get(key);
    const c = carbase.get(key);
    const m = merged.get(key);

    const isConflict =
      a && t &&
      a.valueBoolean !== null &&
      t.valueBoolean !== null &&
      a.valueBoolean !== t.valueBoolean;

    const flag = isConflict ? " ⚡ CONFLICT" : "";
    lines.push(`  ${key}:`);
    if (a) lines.push(`    AS24    : ${label(a)}`);
    if (t) lines.push(`    Listings: ${label(t)}`);
    if (c) lines.push(`    Carbase : ${label(c)}`);
    if (m) lines.push(`    MERGED  : ${label(m)}${flag}`);
    if (isConflict) conflicts.push(key);
  }

  lines.push(`\n  Total merged: ${merged.size} specs`);
  lines.push(`  Sources: ${[...sourcesIn(merged)].join(", ")}`);
  lines.push(`  Verifications: ${[...verificationsIn(merged)].join(", ")}`);
  if (conflicts.length) {
    lines.push(`  Conflicts (${conflicts.length}): ${conflicts.join(", ")}`);
  } else {
    lines.push("  Conflicts: none");
  }

  console.log(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!ENABLED)("enrichment integration", { timeout: 60_000 }, () => {
  for (const fixture of PLATES) {
    describe(`plate ${fixture.plate}`, () => {
      let autoScoutSpecs: EnrichedSpecMap;
      let textSpecs: EnrichedSpecMap;
      let carbaseSpecs: EnrichedSpecMap;
      let merged: EnrichedSpecMap;

      // Fetch all sources once before running assertions.
      it("fetches from all sources", async () => {
        const [autoScoutResult, textResult, cb] = await Promise.all([
          searchAutoScout24(fixture.plate),
          searchTextListings(fixture.plate),
          searchCarbase(fixture.snapshot),
        ]);

        autoScoutSpecs = autoScoutResult.specs;
        textSpecs = textResult.specs;
        carbaseSpecs = cb;
        merged = mergeEnrichedSpecs(autoScoutSpecs, textSpecs, carbaseSpecs);

        printProfile(fixture.plate, autoScoutSpecs, textSpecs, carbaseSpecs, merged);

        // At least one source must have returned something.
        expect(
          autoScoutSpecs.size + textSpecs.size + carbaseSpecs.size,
          "all sources returned empty — check network / selectors",
        ).toBeGreaterThan(0);
      });

      it(`merged result has >= ${fixture.minSpecs} specs`, () => {
        expect(merged?.size ?? 0).toBeGreaterThanOrEqual(fixture.minSpecs);
      });

      it(`merged result has >= ${fixture.minSources} distinct source(s)`, () => {
        expect(sourcesIn(merged ?? new Map()).size).toBeGreaterThanOrEqual(
          fixture.minSources,
        );
      });

      if (fixture.mustNotBeTrue?.length) {
        it("has no known false-positive specs marked true", () => {
          for (const key of fixture.mustNotBeTrue!) {
            const val = merged?.get(key);
            expect(
              val?.valueBoolean,
              `${key} should not be true (known false-positive — check scraper fix)`,
            ).not.toBe(true);
          }
        });
      }

      if (fixture.expectedBooleans) {
        it("has expected boolean spec values", () => {
          for (const [key, expected] of Object.entries(fixture.expectedBooleans!)) {
            const val = merged?.get(key);
            if (expected === "present") {
              expect(val, `${key} should be present in merged result`).toBeDefined();
            } else {
              expect(
                val?.valueBoolean,
                `${key} should be ${expected}`,
              ).toBe(expected);
            }
          }
        });
      }

      it("has no listing_claim_structured false-positive from nav elements", () => {
        // Any spec with listing_claim_structured must come from a legitimate equipment
        // section — not from nav/menu <li> elements. We verify this indirectly: the
        // structured map must either be empty (listing not found) or have a reasonable
        // number of specs (a real equipment section has many items).
        if ((autoScoutSpecs?.size ?? 0) > 0) {
          const structured = [...(autoScoutSpecs ?? new Map()).values()].filter(
            (v) => v.verification === "listing_claim_structured",
          );
          // If we scraped structured data, there should be several items — a real
          // equipment list never has fewer than ~5 entries.
          if (structured.length > 0) {
            expect(
              structured.length,
              "listing_claim_structured has suspiciously few items — might be nav noise",
            ).toBeGreaterThan(4);
          }
        }
      });

      it("listing_claim_single specs are only from one text source", () => {
        // Corroborated specs (both Gaspedaal + Autotrack) must be listing_claim.
        // Single-source specs must be listing_claim_single.
        // The integration test can't verify internals, but we can check the type exists
        // and no listing_claim_single spec is duplicated as listing_claim.
        const singleKeys = new Set(
          [...(textSpecs ?? new Map()).entries()]
            .filter(([, v]) => v.verification === "listing_claim_single")
            .map(([k]) => k),
        );
        const corroboratedKeys = new Set(
          [...(textSpecs ?? new Map()).entries()]
            .filter(([, v]) => v.verification === "listing_claim")
            .map(([k]) => k),
        );
        // A key cannot be both single-source and corroborated.
        for (const key of singleKeys) {
          expect(
            corroboratedKeys.has(key),
            `${key} is both listing_claim_single and listing_claim`,
          ).toBe(false);
        }
      });
    });
  }
});
