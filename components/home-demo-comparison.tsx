import {
  ComparisonTable,
  type ComparisonGroup,
} from "@/components/comparison-table";
import { DataDisclaimer } from "@/components/data-disclaimer";
import { loadComparisonSpecifications } from "@/lib/specifications/load";
import { buildDemoComparisonGroups } from "@/lib/specifications/demo";

const DEMO_KENTEKENS = ["AB-123-C", "CD-456-E"];

export async function HomeDemoComparison() {
  const specifications = await loadComparisonSpecifications();
  const groups: ComparisonGroup[] = buildDemoComparisonGroups(specifications);

  return (
    <section id="voorbeeld" className="border-t border-kv-border bg-kv-surface scroll-mt-24">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-kv-navy">
            Voorbeeld: kentekens vergelijken op uitrusting
          </h2>
          <p className="mt-4 text-lg leading-8 text-kv-muted">
            Twee auto&apos;s van hetzelfde model kunnen totaal anders uitgerust zijn.
            Zo ziet een vergelijking eruit.
          </p>
        </div>

        <div className="kv-card overflow-hidden p-0 sm:p-0">
          <ComparisonTable
            kentekens={DEMO_KENTEKENS}
            groups={groups}
            caption="Voorbeeldvergelijking van twee Volkswagen Golf auto's"
          />
        </div>

        <DataDisclaimer className="mt-6" />
      </div>
    </section>
  );
}
