import {
  ComparisonTable,
  sliceComparisonGroups,
  type ComparisonGroup,
} from "@/components/comparison-table";

type ComparisonPreviewProps = {
  kentekens: string[];
};

const PLACEHOLDER_GROUPS: ComparisonGroup[] = [
  {
    title: "Algemeen",
    rows: [
      { label: "Merk & model", values: ["-", "-", "-", "-"] },
      { label: "Uitvoering / pakket", values: ["-", "-", "-", "-"] },
    ],
  },
  {
    title: "Motor & aandrijving",
    rows: [
      { label: "Brandstof", values: ["-", "-", "-", "-"] },
      { label: "Vermogen", values: ["-", "-", "-", "-"] },
    ],
  },
  {
    title: "Uitrusting & opties",
    rows: [
      { label: "Stoelverwarming", values: ["-", "-", "-", "-"] },
      { label: "Rijassistentie", values: ["-", "-", "-", "-"] },
      { label: "Navigatie", values: ["-", "-", "-", "-"] },
      { label: "LED verlichting", values: ["-", "-", "-", "-"] },
    ],
  },
];

export function ComparisonPreview({ kentekens }: ComparisonPreviewProps) {
  const groups = sliceComparisonGroups(PLACEHOLDER_GROUPS, kentekens.length);

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
        groups={groups}
        caption={`Vergelijkingstabel voor ${kentekens.join(", ")}`}
      />
    </section>
  );
}
