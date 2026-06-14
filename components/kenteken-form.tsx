"use client";

import { useState } from "react";
import { KentekenInput } from "@/components/kenteken-input";
import { formatKenteken, isValidKenteken, normalizeKenteken } from "@/lib/kenteken";

const MIN_PLATES = 2;
const MAX_PLATES = 4;

type KentekenFormProps = {
  onCompare: (kentekens: string[]) => void;
};

export function KentekenForm({ onCompare }: KentekenFormProps) {
  const [plates, setPlates] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  function updatePlate(index: number, value: string) {
    setPlates((current) =>
      current.map((plate, i) => (i === index ? value : plate)),
    );
    setError(null);
  }

  function addPlate() {
    if (plates.length >= MAX_PLATES) return;
    setPlates((current) => [...current, ""]);
  }

  function removePlate(index: number) {
    if (plates.length <= MIN_PLATES) return;
    setPlates((current) => current.filter((_, i) => i !== index));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formatted = plates
      .map((plate) => formatKenteken(plate))
      .filter((plate) => normalizeKenteken(plate).length > 0);

    if (formatted.length < MIN_PLATES) {
      setError(`Voer minimaal ${MIN_PLATES} kentekens in om te vergelijken.`);
      return;
    }

    const invalid = formatted.find((plate) => !isValidKenteken(plate));
    if (invalid) {
      setError(`"${invalid}" is geen geldig kenteken. Een Nederlands kenteken heeft 6 tekens.`);
      return;
    }

    const unique = new Set(formatted.map(normalizeKenteken));
    if (unique.size !== formatted.length) {
      setError("Elk kenteken mag maar één keer voorkomen.");
      return;
    }

    onCompare(formatted);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8"
      aria-label="Kentekens vergelijken"
    >
      <div className="mb-6 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Voer kentekens in</h2>
        <p className="text-sm text-slate-600">
          Minimaal {MIN_PLATES}, maximaal {MAX_PLATES} Nederlandse kentekens. Met of zonder streepjes.
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
              onChange={(value) => updatePlate(index, value)}
            />

            {plates.length > MIN_PLATES && (
              <button
                type="button"
                onClick={() => removePlate(index)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label={`Kenteken ${index + 1} verwijderen`}
              >
                Verwijder
              </button>
            )}
          </div>
        ))}
      </div>

      {plates.length < MAX_PLATES && (
        <button
          type="button"
          onClick={addPlate}
          className="mt-4 text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          + Kenteken toevoegen
        </button>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="mt-6 w-full rounded-xl bg-blue-700 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Vergelijk auto&apos;s
      </button>
    </form>
  );
}
