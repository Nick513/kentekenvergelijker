import {
  ComparisonTable,
  type ComparisonGroup,
} from "@/components/comparison-table";
import { loadComparisonSpecifications } from "@/lib/specifications/load";
import { buildDemoComparisonGroups } from "@/lib/specifications/demo";

const DEMO_KENTEKENS = ["AB-123-C", "CD-456-E"];

export async function HomeDemoComparison() {
  const specifications = await loadComparisonSpecifications();
  const groups: ComparisonGroup[] = buildDemoComparisonGroups(specifications);

  return (
    <section
      id="voorbeeld"
      aria-labelledby="voorbeeld-heading"
      className="kv-scroll-anchor border-t border-kv-border bg-kv-surface"
    >
      <div className="kv-container py-12 sm:py-16">
        <div className="mb-6 max-w-2xl sm:mb-8">
          <h2
            id="voorbeeld-heading"
            className="text-2xl font-semibold tracking-tight text-kv-navy sm:text-3xl"
          >
            Voorbeeld: kentekens vergelijken op uitrusting
          </h2>
          <p className="mt-3 text-base leading-7 text-kv-muted sm:mt-4 sm:text-lg sm:leading-8">
            Twee auto&apos;s van hetzelfde model kunnen totaal anders uitgerust zijn.
            Zo ziet een vergelijking eruit.
          </p>
        </div>

        <div className="kv-card overflow-hidden p-0">
          <ComparisonTable
            kentekens={DEMO_KENTEKENS}
            groups={groups}
            caption="Voorbeeldvergelijking van twee Volkswagen Golf auto's"
          />
        </div>
      </div>
    </section>
  );
}
