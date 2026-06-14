"use client";

import { useRef } from "react";
import { formatKenteken, normalizeKenteken } from "@/lib/kenteken";

type KentekenInputProps = {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

function getCursorPosition(formatted: string, alphanumCount: number): number {
  if (alphanumCount <= 0) return 0;

  let seen = 0;

  for (let index = 0; index < formatted.length; index++) {
    if (/[A-Za-z0-9]/.test(formatted[index])) {
      seen++;
      if (seen === alphanumCount) {
        return index + 1;
      }
    }
  }

  return formatted.length;
}

export function KentekenInput({
  id,
  name,
  value,
  placeholder = "AB-123-C",
  onChange,
}: KentekenInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const cursorPosition = input.selectionStart ?? input.value.length;
    const previousNormalized = normalizeKenteken(value);
    const normalized = normalizeKenteken(input.value);
    const formatted = formatKenteken(normalized);

    const alphanumBeforeCursor = normalizeKenteken(
      input.value.slice(0, cursorPosition),
    ).length;

    const appendedAtEnd =
      normalized.length > previousNormalized.length &&
      cursorPosition >= value.length;

    const alphanumTarget = appendedAtEnd ? normalized.length : alphanumBeforeCursor;

    onChange(formatted);

    requestAnimationFrame(() => {
      const element = inputRef.current;
      if (!element) return;

      const nextCursor = getCursorPosition(formatted, alphanumTarget);
      element.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="relative flex-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 flex h-6 w-4 -translate-y-1/2 items-center justify-center rounded-sm bg-[#003399] text-[8px] font-bold leading-none text-yellow-300"
      >
        NL
      </span>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="kenteken-input w-full rounded-lg border-2 border-slate-900/10 bg-[#F5C518] py-3 pl-10 pr-4 text-lg font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-900/30 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
      />
    </div>
  );
}
