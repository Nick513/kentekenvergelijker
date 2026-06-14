type ComparisonPreviewProps = {
  kentekens: string[];
};

const PLACEHOLDER_ROWS = [
  "Merk & model",
  "Uitvoering / pakket",
  "Brandstof",
  "Vermogen",
  "Stoelverwarming",
  "Rijassistentie",
  "Navigatie",
  "LED verlichting",
];

function KentekenPlateChip({ kenteken }: { kenteken: string }) {
  return (
    <span className="kv-plate-chip">
      <span aria-hidden="true" className="kv-plate-eu">
        <span className="kv-plate-eu-stars" />
        <span className="kv-plate-eu-code">NL</span>
      </span>
      <span className="kv-plate-chip-text">{kenteken}</span>
    </span>
  );
}

export function ComparisonPreview({ kentekens }: ComparisonPreviewProps) {
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

      <div className="overflow-x-auto rounded-xl border border-kv-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Vergelijkingstabel voor {kentekens.join(", ")}
          </caption>
          <thead>
            <tr className="bg-kv-navy text-white">
              <th scope="col" className="px-4 py-3.5 font-semibold text-white/70">
                Specificatie
              </th>
              {kentekens.map((kenteken) => (
                <th key={kenteken} scope="col" className="px-4 py-3.5 font-semibold">
                  <KentekenPlateChip kenteken={kenteken} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-kv-surface">
            {PLACEHOLDER_ROWS.map((row, rowIndex) => (
              <tr
                key={row}
                className={rowIndex % 2 === 0 ? "bg-kv-surface" : "bg-kv-bg/60"}
              >
                <th
                  scope="row"
                  className="border-t border-kv-border px-4 py-3 font-medium text-kv-navy"
                >
                  {row}
                </th>
                {kentekens.map((kenteken) => (
                  <td
                    key={`${row}-${kenteken}`}
                    className="border-t border-kv-border px-4 py-3 text-kv-muted"
                  >
                    -
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
