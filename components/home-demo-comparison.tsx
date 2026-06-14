import { ComparisonTable } from "@/components/comparison-table";

const DEMO_KENTEKENS = ["AB-123-C", "CD-456-E"];

const DEMO_ROWS = [
  { label: "Merk & model", values: ["Volkswagen Golf", "Volkswagen Golf"] },
  { label: "Uitvoering / pakket", values: ["Life", "Style"] },
  { label: "Bouwjaar", values: ["2019", "2021"] },
  { label: "Brandstof", values: ["Benzine", "Benzine"] },
  { label: "Vermogen", values: ["110 pk", "130 pk"] },
  { label: "Stoelverwarming", values: [false, true] },
  { label: "Adaptive cruise control", values: [false, true] },
  { label: "Navigatie", values: [true, true] },
  { label: "LED koplampen", values: [false, true] },
  { label: "Parkeersensoren achter", values: [true, true] },
  { label: "Parkeersensoren voor", values: [false, true] },
];

export function HomeDemoComparison() {
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
            rows={DEMO_ROWS}
            caption="Voorbeeldvergelijking van twee Volkswagen Golf auto's"
          />
        </div>

        <p className="mt-4 text-sm text-kv-muted">
          Illustratieve gegevens ter demonstratie.
        </p>
      </div>
    </section>
  );
}
