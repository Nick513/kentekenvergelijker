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

export function ComparisonPreview({ kentekens }: ComparisonPreviewProps) {
  return (
    <section
      id="vergelijking"
      aria-labelledby="comparison-heading"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6 space-y-2">
        <h2 id="comparison-heading" className="text-2xl font-semibold text-slate-900">
          Jouw vergelijking
        </h2>
        <p className="text-slate-600">
          Specificaties voor{" "}
          {kentekens.map((kenteken, index) => (
            <span key={kenteken}>
              <strong className="font-semibold text-slate-900">{kenteken}</strong>
              {index < kentekens.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          worden binnenkort opgehaald. Onderstaande tabel toont alvast de opbouw.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Vergelijkingstabel voor {kentekens.join(", ")}
          </caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="px-4 py-3 font-semibold text-slate-500">
                Specificatie
              </th>
              {kentekens.map((kenteken) => (
                <th
                  key={kenteken}
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-900"
                >
                  <span className="inline-block rounded-md bg-[#F5C518] px-2 py-1 font-mono text-xs tracking-widest text-slate-900">
                    {kenteken}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_ROWS.map((row) => (
              <tr key={row} className="border-b border-slate-100 last:border-0">
                <th scope="row" className="px-4 py-3 font-medium text-slate-700">
                  {row}
                </th>
                {kentekens.map((kenteken) => (
                  <td key={`${row}-${kenteken}`} className="px-4 py-3 text-slate-400">
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
