"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KentekenInput } from "@/components/kenteken-input";
import {
  buildComparisonPath,
  formatKenteken,
  isValidKenteken,
  MAX_COMPARISON_PLATES,
  MIN_COMPARISON_PLATES,
  normalizeKenteken,
} from "@/lib/kenteken";

export function KentekenForm() {
  const router = useRouter();
  const [plates, setPlates] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  function updatePlate(index: number, normalized: string) {
    setPlates((current) =>
      current.map((plate, i) => (i === index ? normalized : plate)),
    );
    setError(null);
  }

  function addPlate() {
    if (plates.length >= MAX_COMPARISON_PLATES) return;
    setPlates((current) => [...current, ""]);
  }

  function removePlate(index: number) {
    if (plates.length <= MIN_COMPARISON_PLATES) return;
    setPlates((current) => current.filter((_, i) => i !== index));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const kentekens = plates.filter((plate) => plate.length > 0);

    if (kentekens.length < MIN_COMPARISON_PLATES) {
      setError(`Voer minimaal ${MIN_COMPARISON_PLATES} kentekens in om te vergelijken.`);
      return;
    }

    const invalid = kentekens.find((plate) => !isValidKenteken(plate));
    if (invalid) {
      setError(`"${formatKenteken(invalid)}" is geen geldig kenteken. Een kenteken heeft 6 tekens.`);
      return;
    }

    const unique = new Set(kentekens);
    if (unique.size !== kentekens.length) {
      setError("Elk kenteken mag maar één keer voorkomen.");
      return;
    }

    router.push(buildComparisonPath(kentekens.map(formatKenteken)));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="kv-card w-full p-6 sm:p-8"
      aria-label="Kentekens vergelijken"
    >
      <div className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold text-kv-navy">Voer kentekens in</h2>
        <p className="text-sm text-kv-muted">
          Minimaal {MIN_COMPARISON_PLATES}, maximaal {MAX_COMPARISON_PLATES} kentekens. Met of
          zonder streepjes.
        </p>
      </div>

      <div className="space-y-3">
        {plates.map((plate, index) => (
          <div key={index} className="flex items-center gap-3">
            <label htmlFor={`kenteken-${index}`} className="sr-only">
              Kenteken {index + 1}
            </label>
            <KentekenInput
              id={`kenteken-${index}`}
              name={`kenteken-${index}`}
              placeholder="AB-123-C"
              value={plate}
              onChange={(normalized) => updatePlate(index, normalized)}
            />

            <button
              type="button"
              onClick={() => removePlate(index)}
              className="kv-btn-ghost shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={plates.length <= MIN_COMPARISON_PLATES}
              aria-label={`Kenteken ${index + 1} verwijderen`}
            >
              Verwijder
            </button>
          </div>
        ))}
      </div>

      {plates.length < MAX_COMPARISON_PLATES && (
        <button
          type="button"
          onClick={addPlate}
          className="kv-btn-link mt-4 text-sm"
        >
          + Kenteken toevoegen
        </button>
      )}

      {error && (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className="kv-btn-primary mt-6 w-full rounded-xl px-6 py-4 text-base shadow-lg shadow-kv-teal/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kv-teal"
      >
        Vergelijk auto&apos;s
      </button>
    </form>
  );
}
