import {
  ComparisonTable,
  type ComparisonGroup,
} from "@/components/comparison-table";
import { DataDisclaimer } from "@/components/data-disclaimer";

type ComparisonPreviewProps = {
  kentekens: string[];
  groups: ComparisonGroup[];
  hasNotFound?: boolean;
  hasErrors?: boolean;
};

export function ComparisonPreview({
  kentekens,
  groups,
  hasNotFound = false,
  hasErrors = false,
}: ComparisonPreviewProps) {
  return (
    <section
      id="vergelijking"
      aria-labelledby="comparison-heading"
      className="kv-card scroll-mt-24 p-6 sm:p-8"
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
          ))}{" "}
          opgehaald via het RDW-register.
        </p>
        {hasNotFound ? (
          <p className="text-sm text-kv-muted" role="status">
            Een of meer kentekens zijn niet gevonden in het RDW-register.
          </p>
        ) : null}
        {hasErrors ? (
          <p className="text-sm text-kv-muted" role="status">
            Sommige gegevens zijn tijdelijk niet beschikbaar. Probeer het later
            opnieuw.
          </p>
        ) : null}
      </div>

      <ComparisonTable
        kentekens={kentekens}
        groups={groups}
        caption={`Vergelijkingstabel voor ${kentekens.join(", ")}`}
      />

      <DataDisclaimer className="mt-6" />
    </section>
  );
}
