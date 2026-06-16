import { NextResponse } from "next/server";
import { searchAutoScout24 } from "@/lib/enrichment/autoscout24";
import { searchCarbase } from "@/lib/enrichment/carbase";
import { mergeEnrichedSpecs } from "@/lib/enrichment/keywords";
import { searchTextListings } from "@/lib/enrichment/listings";
import { savePlateEnrichment } from "@/lib/enrichment/store";
import type { EnrichedSpecMap } from "@/lib/enrichment/types";
import { loadComparisonSpecifications } from "@/lib/specifications/load";
import { buildComparisonGroups } from "@/lib/specifications/resolve";
import { fetchPlate } from "@/lib/vehicles/compare";
import type { ComparisonGroup } from "@/components/comparison-table";
import type { PlateFetchResult, VehicleSnapshot } from "@/lib/rdw/types";

type SsePayload = { groups: ComparisonGroup[]; done: boolean };

function sseChunk(payload: SsePayload, encoder: TextEncoder): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildGroups(
  specifications: Awaited<ReturnType<typeof loadComparisonSpecifications>>,
  plates: PlateFetchResult[],
  accumulated: Map<string, EnrichedSpecMap>,
): ComparisonGroup[] {
  const enrichedMaps = plates.map((p) => {
    if (p.status !== "ok") return null;
    const a = accumulated.get(p.snapshot.licensePlate);
    return a && a.size > 0 ? a : null;
  });
  return buildComparisonGroups(specifications, plates, enrichedMaps);
}

export async function POST(request: Request) {
  let body: { kentekens?: string[]; skipCache?: boolean };
  try {
    body = (await request.json()) as { kentekens?: string[]; skipCache?: boolean };
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (groups: ComparisonGroup[], done: boolean) => {
        controller.enqueue(sseChunk({ groups, done }, encoder));
      };

      try {
        const [specifications, plates] = await Promise.all([
          loadComparisonSpecifications(),
          Promise.all(kentekens.map((k) => fetchPlate(k))),
        ]);

        const okPlates = plates.filter(
          (p): p is PlateFetchResult & { status: "ok" } => p.status === "ok",
        );

        // Per-plate accumulated specs (merged as each source completes)
        const accumulated = new Map<string, EnrichedSpecMap>(
          okPlates.map((p) => [p.snapshot.licensePlate, new Map()]),
        );

        const totalSources = okPlates.length * 3;
        let sourcesCompleted = 0;

        const onSourceComplete = (lp: string, specs: EnrichedSpecMap) => {
          if (specs.size > 0) {
            const prev = accumulated.get(lp)!;
            // accumulated wins ties (first-come for equal priority)
            accumulated.set(lp, mergeEnrichedSpecs(prev, specs));
          }
          sourcesCompleted++;
          emit(buildGroups(specifications, plates, accumulated), sourcesCompleted === totalSources);
        };

        const sourceTasks = (plate: PlateFetchResult & { status: "ok" }) => {
          const lp = plate.snapshot.licensePlate;
          const snap: VehicleSnapshot = plate.snapshot;
          return [
            searchAutoScout24(lp)
              .then((s) => onSourceComplete(lp, s))
              .catch(() => onSourceComplete(lp, new Map())),
            searchTextListings(lp)
              .then((s) => onSourceComplete(lp, s))
              .catch(() => onSourceComplete(lp, new Map())),
            searchCarbase(snap)
              .then((s) => onSourceComplete(lp, s))
              .catch(() => onSourceComplete(lp, new Map())),
          ];
        };

        await Promise.all(okPlates.flatMap(sourceTasks));

        // Persist final merged specs
        await Promise.all(
          okPlates.map((p) => {
            const specs = accumulated.get(p.snapshot.licensePlate)!;
            return specs.size > 0
              ? savePlateEnrichment(p.snapshot.licensePlate, specs)
              : Promise.resolve();
          }),
        );
      } catch {
        // Emit a done event so the client unblocks even on errors
        emit([], true);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
