import {
  type ComparisonGroup,
} from "@/components/comparison-table";
import { DataDisclaimer } from "@/components/data-disclaimer";
import { SearchableComparisonTable } from "@/components/searchable-comparison-table";

type ComparisonPreviewProps = {
  kentekens: string[];
  groups: ComparisonGroup[];
  hasErrors?: boolean;
  isEnriching?: boolean;
  enrichError?: boolean;
  onRetryEnrichment?: () => void;
};

export function ComparisonPreview({
  kentekens,
  groups,
  hasErrors = false,
  isEnriching = false,
  enrichError = false,
  onRetryEnrichment,
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
        {isEnriching ? (
          <p className="text-sm text-kv-muted" role="status" aria-live="polite">
            Advertentiegegevens worden opgezocht om specificaties te verrijken…
          </p>
        ) : null}
        {enrichError ? (
          <p className="text-sm text-kv-muted" role="status">
            Extra specificaties zijn niet geladen.{" "}
            {onRetryEnrichment ? (
              <button
                type="button"
                onClick={onRetryEnrichment}
                className="underline decoration-kv-teal/60 underline-offset-2 hover:text-kv-teal"
              >
                Opnieuw proberen
              </button>
            ) : null}
          </p>
        ) : null}
        {hasErrors ? (
          <p className="text-sm text-kv-muted" role="status">
            Sommige gegevens zijn tijdelijk niet beschikbaar. Probeer het later
            opnieuw.
          </p>
        ) : null}
      </div>

      <SearchableComparisonTable
        kentekens={kentekens}
        groups={groups}
        caption={`Vergelijkingstabel voor ${kentekens.join(", ")}`}
        isLoading={isEnriching}
      />

      <DataDisclaimer className="mt-6" />
    </section>
  );
}
