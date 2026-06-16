import { describe, expect, it } from "vitest";
import {
  countComparisonRows,
  filterComparisonGroups,
  type ComparisonGroup,
} from "@/components/comparison-table";

const sampleGroups: ComparisonGroup[] = [
  {
    title: "Algemeen",
    rows: [
      {
        label: "Merk & model",
        values: [
          { value: "VW Golf", verification: "verified" },
          { value: "VW Golf", verification: "verified" },
        ],
      },
      {
        label: "Carrosserie",
        values: [
          { value: "Hatchback", verification: "verified" },
          { value: "Hatchback", verification: "verified" },
        ],
      },
    ],
  },
  {
    title: "Veiligheid & assistentie",
    rows: [
      {
        label: "ABS",
        values: [
          { value: true, verification: "trim_inferred" },
          { value: true, verification: "trim_inferred" },
        ],
      },
      {
        label: "Lane assist",
        values: [
          { value: false, verification: null },
          { value: true, verification: "listing_claim" },
        ],
      },
    ],
  },
];

describe("filterComparisonGroups", () => {
  it("returns all groups when query is empty", () => {
    expect(filterComparisonGroups(sampleGroups, "")).toEqual(sampleGroups);
    expect(filterComparisonGroups(sampleGroups, "   ")).toEqual(sampleGroups);
  });

  it("filters rows by label", () => {
    const result = filterComparisonGroups(sampleGroups, "lane");

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Veiligheid & assistentie");
    expect(result[0]?.rows.map((row) => row.label)).toEqual(["Lane assist"]);
  });

  it("returns all rows in a group when the group title matches", () => {
    const result = filterComparisonGroups(sampleGroups, "algemeen");

    expect(result).toHaveLength(1);
    expect(result[0]?.rows).toHaveLength(2);
  });

  it("is case insensitive", () => {
    const result = filterComparisonGroups(sampleGroups, "MERK");

    expect(result).toHaveLength(1);
    expect(result[0]?.rows.map((row) => row.label)).toEqual(["Merk & model"]);
  });
});

describe("countComparisonRows", () => {
  it("counts all rows across groups", () => {
    expect(countComparisonRows(sampleGroups)).toBe(4);
  });
});
