"use client";

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
    <div className="relative min-w-0 flex-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 flex h-6 w-4 -translate-y-1/2 items-center justify-center rounded-sm bg-[#003399] text-[8px] font-bold leading-none text-yellow-300"
      >
        NL
      </span>
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
        className="kenteken-input w-full rounded-lg border-2 border-slate-900/10 bg-[#F5C518] py-3 pl-10 pr-4 text-lg font-bold uppercase tracking-wide text-slate-900 placeholder:text-slate-900/30 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
      />
    </div>
  );
}
