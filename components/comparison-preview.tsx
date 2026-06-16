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
      className="kv-scroll-anchor kv-card p-6 sm:p-8"
    >
      <div className="mb-6 space-y-2">
        <h2 id="comparison-heading" className="text-2xl font-semibold text-kv-navy">
          Jouw vergelijking
        </h2>
        <p className="text-kv-muted">
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

      <SearchableComparisonTable
        kentekens={kentekens}
        groups={groups}
        caption={`Vergelijkingstabel voor ${kentekens.join(", ")}`}
        isLoading={isEnriching}
        stickyPlates
      />

      <DataDisclaimer className="mt-6" />
    </section>
  );
}
