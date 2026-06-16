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
      setError(`"${formatKenteken(invalid)}" is geen geldig Nederlands kenteken.`);
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
      className="kv-card w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-8"
      aria-label="Kentekens vergelijken"
    >
      <div className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold text-kv-navy">Voer kentekens in</h2>
        <p className="text-sm leading-6 text-kv-muted">
          {`Voer minimaal ${MIN_COMPARISON_PLATES} en maximaal ${MAX_COMPARISON_PLATES} Nederlandse kentekens in van de auto's die je wilt vergelijken. Je krijgt direct een overzicht van model, uitvoering en opties naast elkaar.`}
        </p>
      </div>

      <div className="space-y-3">
        {plates.map((plate, index) => (
          <div
            key={index}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3"
          >
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
              className="kv-btn-ghost flex size-10 shrink-0 items-center justify-center rounded-lg p-0 disabled:cursor-not-allowed disabled:opacity-40 sm:size-auto sm:px-3 sm:py-2"
              disabled={plates.length <= MIN_COMPARISON_PLATES}
              aria-label={`Kenteken ${index + 1} verwijderen`}
            >
              <span className="hidden sm:inline">Verwijder</span>
              <span className="text-xl leading-none sm:hidden" aria-hidden="true">
                ×
              </span>
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
          className="kv-alert-error mt-4 rounded-lg px-4 py-3 text-sm"
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
