import { NextResponse } from "next/server";
import { enrichPlates } from "@/lib/enrichment/enrich-plate";
import { loadComparisonSpecifications } from "@/lib/specifications/load";
import { buildComparisonGroups } from "@/lib/specifications/resolve";
import { fetchPlate } from "@/lib/vehicles/compare";
import type { PlateFetchResult } from "@/lib/rdw/types";

export async function POST(request: Request) {
  let body: { kentekens?: string[]; refresh?: boolean };
  try {
    body = (await request.json()) as { kentekens?: string[]; refresh?: boolean };
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const kentekens = body.kentekens ?? [];
  if (kentekens.length < 2 || kentekens.length > 8) {
    return NextResponse.json(
      { error: "Voer tussen 2 en 8 kentekens in." },
      { status: 400 },
    );
  }

  const refresh = body.refresh === true;

  const [specifications, plates] = await Promise.all([
    loadComparisonSpecifications(),
    Promise.all(kentekens.map((kenteken) => fetchPlate(kenteken))),
  ]);

  const okSnapshots = plates
    .filter((plate): plate is PlateFetchResult & { status: "ok" } => plate.status === "ok")
    .map((plate) => plate.snapshot);

  const enrichedForOk = await enrichPlates(okSnapshots, { skipCache: refresh });

  let enrichedIndex = 0;
  const alignedEnriched = plates.map((plate) => {
    if (plate.status !== "ok") {
      return null;
    }
    const map = enrichedForOk[enrichedIndex] ?? new Map();
    enrichedIndex += 1;
    return map;
  });

  const groups = buildComparisonGroups(
    specifications,
    plates,
    alignedEnriched,
  );

  return NextResponse.json({
    groups,
    status: "complete",
  });
}
