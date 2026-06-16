import type { SpecVerification } from "@/lib/enrichment/types";

export function isUnverifiedForDisplay(verification: SpecVerification): boolean {
  return verification === "trim_inferred";
}
