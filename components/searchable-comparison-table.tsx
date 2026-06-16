"use client";

import { useId, useMemo, useState } from "react";
import {
  ComparisonTable,
  countComparisonRows,
  filterComparisonGroups,
  type ComparisonGroup,
} from "@/components/comparison-table";

type SearchableComparisonTableProps = {
  kentekens: string[];
  groups: ComparisonGroup[];
  caption?: string;
  isLoading?: boolean;
};

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 text-kv-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

export function SearchableComparisonTable({
  kentekens,
  groups,
  caption,
  isLoading = false,
}: SearchableComparisonTableProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(
    () => filterComparisonGroups(groups, query),
    [groups, query],
  );
  const totalRows = useMemo(() => countComparisonRows(groups), [groups]);
  const visibleRows = useMemo(
    () => countComparisonRows(filteredGroups),
    [filteredGroups],
  );

  const trimmedQuery = query.trim();
  const isFiltering = trimmedQuery.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={searchId} className="sr-only">
          Zoek specificaties
        </label>
        <div className="relative w-full sm:max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <SearchIcon />
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek specificaties..."
            autoComplete="off"
            className="kv-search-input w-full rounded-xl border border-kv-border bg-kv-surface py-2.5 pr-4 pl-10 text-sm text-kv-navy shadow-sm transition-colors placeholder:text-kv-muted focus:border-kv-teal focus:ring-2 focus:ring-kv-teal/20 focus:outline-none"
          />
        </div>
        {isFiltering ? (
          <p className="text-sm text-kv-muted" role="status" aria-live="polite">
            {visibleRows === 0
              ? "Geen specificaties gevonden"
              : `${visibleRows} van ${totalRows} specificaties`}
          </p>
        ) : null}
      </div>

      {isFiltering && visibleRows === 0 ? (
        <p className="rounded-xl border border-kv-border bg-kv-bg/60 px-4 py-6 text-center text-sm text-kv-muted">
          Geen specificaties gevonden voor &ldquo;{trimmedQuery}&rdquo;. Probeer
          een andere zoekterm of een groepsnaam zoals &ldquo;Veiligheid&rdquo;.
        </p>
      ) : (
        <div className={isLoading ? "opacity-70 transition-opacity" : undefined}>
          <ComparisonTable
            kentekens={kentekens}
            groups={filteredGroups}
            caption={caption}
          />
        </div>
      )}
    </div>
  );
}
