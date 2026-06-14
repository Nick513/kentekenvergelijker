"use client";

import { KentekenPlateEuStrip } from "@/components/kenteken-plate-eu";
import { formatKenteken, normalizeKenteken } from "@/lib/kenteken";

type KentekenInputProps = {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  onChange: (normalized: string) => void;
};

export function KentekenInput({
  id,
  name,
  value,
  placeholder = "AB-123-C",
  onChange,
}: KentekenInputProps) {
  return (
    <div className="kv-plate min-w-0 flex-1">
      <KentekenPlateEuStrip />
      <input
        id={id}
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={placeholder}
        value={formatKenteken(value)}
        onChange={(event) => onChange(normalizeKenteken(event.target.value))}
        className="kenteken-input kv-plate-field"
      />
    </div>
  );
}
