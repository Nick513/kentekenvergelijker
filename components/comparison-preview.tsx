import { ComparisonTable } from "@/components/comparison-table";

type ComparisonPreviewProps = {
  kentekens: string[];
};

const PLACEHOLDER_ROWS = [
  { label: "Merk & model", values: ["-", "-", "-", "-"] as const },
  { label: "Uitvoering / pakket", values: ["-", "-", "-", "-"] as const },
  { label: "Brandstof", values: ["-", "-", "-", "-"] as const },
  { label: "Vermogen", values: ["-", "-", "-", "-"] as const },
  { label: "Stoelverwarming", values: ["-", "-", "-", "-"] as const },
  { label: "Rijassistentie", values: ["-", "-", "-", "-"] as const },
  { label: "Navigatie", values: ["-", "-", "-", "-"] as const },
  { label: "LED verlichting", values: ["-", "-", "-", "-"] as const },
];

export function ComparisonPreview({ kentekens }: ComparisonPreviewProps) {
  const rows = PLACEHOLDER_ROWS.map((row) => ({
    label: row.label,
    values: row.values.slice(0, kentekens.length),
  }));

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
          worden binnenkort opgehaald. Onderstaande tabel toont alvast de opbouw.
        </p>
      </div>

      <ComparisonTable
        kentekens={kentekens}
        rows={rows}
        caption={`Vergelijkingstabel voor ${kentekens.join(", ")}`}
      />
    </section>
  );
}
