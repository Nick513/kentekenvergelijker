import { describe, expect, it } from "vitest";
import {
  MAX_COMPARISON_PLATES,
  MIN_COMPARISON_PLATES,
  buildComparisonPath,
  formatKenteken,
  isValidKenteken,
  normalizeKenteken,
  parseComparisonSlugs,
  slugToKenteken,
  toKentekenSlug,
} from "@/lib/kenteken";

describe("normalizeKenteken", () => {
  it("strips dashes and spaces", () => {
    expect(normalizeKenteken("AB-123-C")).toBe("AB123C");
    expect(normalizeKenteken("ab 123 c")).toBe("AB123C");
  });

  it("uppercases letters", () => {
    expect(normalizeKenteken("ab12cd")).toBe("AB12CD");
  });

  it("ignores non-alphanumeric characters", () => {
    expect(normalizeKenteken("AB.123/C")).toBe("AB123C");
  });

  it("truncates to 6 characters", () => {
    expect(normalizeKenteken("ABCDEFGH")).toBe("ABCDEF");
  });
});

describe("formatKenteken", () => {
  const sidecodes: [string, string][] = [
    ["AB1234", "AB-12-34"], // XX-99-99
    ["1234AB", "12-34-AB"], // 99-99-XX
    ["12AB34", "12-AB-34"], // 99-XX-99
    ["AB12CD", "AB-12-CD"], // XX-99-XX
    ["ABCD12", "AB-CD-12"], // XX-XX-99
    ["12ABCD", "12-AB-CD"], // 99-XX-XX
    ["88ZBP6", "88-ZBP-6"], // 99-XXX-9
    ["1ABC23", "1-ABC-23"], // 9-XXX-99
    ["AB123C", "AB-123-C"], // XX-999-X
    ["X999XX", "X-999-XX"], // X-999-XX
    ["ABC12D", "ABC-12-D"], // XXX-99-X
    ["A12BCD", "A-12-BCD"], // X-99-XXX
    ["1AB234", "1-AB-234"], // 9-XX-999
    ["123AB4", "123-AB-4"], // 999-XX-9
  ];

  it.each(sidecodes)("formats %s as %s", (input, expected) => {
    expect(formatKenteken(input)).toBe(expected);
  });

  it("formats already dashed input", () => {
    expect(formatKenteken("88-ZB-P6")).toBe("88-ZBP-6");
    expect(formatKenteken("AB-123-C")).toBe("AB-123-C");
  });

  it("returns empty string for empty input", () => {
    expect(formatKenteken("")).toBe("");
    expect(formatKenteken("---")).toBe("");
  });

  it("formats partial input while typing", () => {
    expect(formatKenteken("88")).toBe("88");
    expect(formatKenteken("88Z")).toBe("88-Z");
    expect(formatKenteken("88ZB")).toBe("88-ZB");
    expect(formatKenteken("88ZBP")).toBe("88-ZBP");
    expect(formatKenteken("AB")).toBe("AB");
    expect(formatKenteken("AB1")).toBe("AB-1");
    expect(formatKenteken("AB12")).toBe("AB-12");
    expect(formatKenteken("A1")).toBe("A-1");
  });

  it("formats all-digit and all-letter plates with fallback grouping", () => {
    expect(formatKenteken("123456")).toBe("12-34-56");
    expect(formatKenteken("ABCDEF")).toBe("AB-CD-EF");
  });
});

describe("isValidKenteken", () => {
  it("accepts all 14 official sidecode patterns", () => {
    expect(isValidKenteken("AB1234")).toBe(true); // 1
    expect(isValidKenteken("1234AB")).toBe(true); // 2
    expect(isValidKenteken("12AB34")).toBe(true); // 3
    expect(isValidKenteken("AB12CD")).toBe(true); // 4
    expect(isValidKenteken("ABCD12")).toBe(true); // 5
    expect(isValidKenteken("12ABCD")).toBe(true); // 6
    expect(isValidKenteken("88ZBP6")).toBe(true); // 7
    expect(isValidKenteken("1ABC23")).toBe(true); // 8
    expect(isValidKenteken("AB123C")).toBe(true); // 9
    expect(isValidKenteken("X999XX")).toBe(true); // 10
    expect(isValidKenteken("ABC12D")).toBe(true); // 11
    expect(isValidKenteken("A12BCD")).toBe(true); // 12
    expect(isValidKenteken("1AB234")).toBe(true); // 13
    expect(isValidKenteken("123AB4")).toBe(true); // 14
  });

  it("rejects too short input", () => {
    expect(isValidKenteken("AB12")).toBe(false);
    expect(isValidKenteken("")).toBe(false);
  });

  it("rejects plates that do not match any sidecode", () => {
    expect(isValidKenteken("ABCDEF")).toBe(false);
    expect(isValidKenteken("123456")).toBe(false);
  });

  it("validates after normalizing dashes and case", () => {
    expect(isValidKenteken("ab-123-c")).toBe(true);
    expect(isValidKenteken("88-zbp-6")).toBe(true);
  });

  it("truncates overlong input before validating", () => {
    expect(isValidKenteken("AB12345")).toBe(true);
    expect(normalizeKenteken("AB12345")).toBe("AB1234");
  });

  it("rejects forbidden letter combinations", () => {
    expect(isValidKenteken("X99GVD")).toBe(false);
    expect(isValidKenteken("X99KKK")).toBe(false);
    expect(isValidKenteken("X99KVT")).toBe(false);
    expect(isValidKenteken("X99LPF")).toBe(false);
    expect(isValidKenteken("X99NSB")).toBe(false);
    expect(isValidKenteken("X99PKK")).toBe(false);
    expect(isValidKenteken("X99PSV")).toBe(false);
    expect(isValidKenteken("X99SSS")).toBe(false);
    expect(isValidKenteken("X99SDS")).toBe(false);
  });

  it("allows similar letter combos that are not forbidden words", () => {
    expect(isValidKenteken("99AKKK")).toBe(true);
    expect(isValidKenteken("99AGVD")).toBe(true);
    expect(isValidKenteken("99APSV")).toBe(true);
  });

  it("allows VVD on sidecodes below 7", () => {
    expect(isValidKenteken("14VVD4")).toBe(true);
  });

  it("rejects political abbreviations from sidecode 7 onward", () => {
    expect(isValidKenteken("99PVV9")).toBe(false);
    expect(isValidKenteken("9PVV99")).toBe(false);
    expect(isValidKenteken("PVV99X")).toBe(false);
    expect(isValidKenteken("X99PVV")).toBe(false);
    expect(isValidKenteken("99SGP9")).toBe(false);
    expect(isValidKenteken("9SGP99")).toBe(false);
    expect(isValidKenteken("SGP99X")).toBe(false);
    expect(isValidKenteken("X99SGP")).toBe(false);
  });

  it("rejects VVD from sidecode 8 onward", () => {
    expect(isValidKenteken("9VVD99")).toBe(false);
    expect(isValidKenteken("VVD99X")).toBe(false);
    expect(isValidKenteken("X99VVD")).toBe(false);
  });
});

describe("toKentekenSlug", () => {
  it("normalizes to lowercase without dashes", () => {
    expect(toKentekenSlug("AB-123-C")).toBe("ab123c");
    expect(toKentekenSlug("88-ZBP-6")).toBe("88zbp6");
  });
});

describe("slugToKenteken", () => {
  it("formats a URL slug back to display form", () => {
    expect(slugToKenteken("ab123c")).toBe("AB-123-C");
    expect(slugToKenteken("88zbp6")).toBe("88-ZBP-6");
  });
});

describe("buildComparisonPath", () => {
  it("builds a path from formatted kentekens", () => {
    expect(buildComparisonPath(["AB-123-C", "88-ZBP-6"])).toBe(
      "/ab123c/88zbp6",
    );
  });
});

describe("parseComparisonSlugs", () => {
  it("parses valid slugs into formatted kentekens", () => {
    expect(parseComparisonSlugs(["ab123c", "88zbp6"])).toEqual({
      kentekens: ["AB-123-C", "88-ZBP-6"],
      slugs: ["ab123c", "88zbp6"],
    });
  });

  it(`requires between ${MIN_COMPARISON_PLATES} and ${MAX_COMPARISON_PLATES} slugs`, () => {
    expect(parseComparisonSlugs(["ab123c"])).toBeNull();
    expect(
      parseComparisonSlugs([
        "ab123c",
        "88zbp6",
        "ab1234",
        "12ab34",
        "ab12cd",
        "abcd12",
        "12abcd",
        "1abc23",
        "x999xx",
      ]),
    ).toBeNull();
  });

  it(`accepts up to ${MAX_COMPARISON_PLATES} slugs`, () => {
    expect(
      parseComparisonSlugs([
        "ab123c",
        "88zbp6",
        "ab1234",
        "12ab34",
        "ab12cd",
        "abcd12",
        "12abcd",
        "1abc23",
      ]),
    ).toEqual({
      kentekens: [
        "AB-123-C",
        "88-ZBP-6",
        "AB-12-34",
        "12-AB-34",
        "AB-12-CD",
        "AB-CD-12",
        "12-AB-CD",
        "1-ABC-23",
      ],
      slugs: [
        "ab123c",
        "88zbp6",
        "ab1234",
        "12ab34",
        "ab12cd",
        "abcd12",
        "12abcd",
        "1abc23",
      ],
    });
  });

  it("rejects invalid kentekens", () => {
    expect(parseComparisonSlugs(["ab12", "88zbp6"])).toBeNull();
    expect(parseComparisonSlugs(["abcdef", "88zbp6"])).toBeNull();
  });

  it("rejects duplicate kentekens", () => {
    expect(parseComparisonSlugs(["ab123c", "ab123c"])).toBeNull();
    expect(parseComparisonSlugs(["ab123c", "AB-123-C"])).toBeNull();
  });
});
