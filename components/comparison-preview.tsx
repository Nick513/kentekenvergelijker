import {
  type ComparisonGroup,
} from "@/components/comparison-table";
import { DataDisclaimer } from "@/components/data-disclaimer";
import { SearchableComparisonTable } from "@/components/searchable-comparison-table";

type ComparisonPreviewProps = {
  kentekens: string[];
  groups: ComparisonGroup[];
  isEnriching?: boolean;
};

export function ComparisonPreview({
  kentekens,
  groups,
  isEnriching = false,
}: ComparisonPreviewProps) {
  return (
    <section
      id="vergelijking"
      aria-labelledby="comparison-heading"
      className="kv-scroll-anchor kv-card p-4 sm:p-8"
    >
      <div className="mb-5 space-y-2 sm:mb-6">
        <h2 id="comparison-heading" className="text-xl font-semibold text-kv-navy sm:text-2xl">
          Jouw vergelijking
        </h2>
        <p className="text-sm text-kv-muted sm:text-base">
          Specificaties voor{" "}
          {kentekens.map((kenteken, index) => (
            <span key={kenteken}>
              <strong className="font-semibold text-kv-navy">{kenteken}</strong>
              {index < kentekens.length - 1 ? ", " : ""}
            </span>
          ))}
          .
        </p>
      </div>

      <div className="-mx-4 sm:mx-0">
        <SearchableComparisonTable
          kentekens={kentekens}
          groups={groups}
          caption={`Vergelijkingstabel voor ${kentekens.join(", ")}`}
          isLoading={isEnriching}
          stickyPlates
        />
      </div>

      <DataDisclaimer className="mt-6" />
    </section>
  );
}
