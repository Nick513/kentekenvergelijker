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
  stickyPlates?: boolean;
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
  stickyPlates = false,
}: SearchableComparisonTableProps) {
  const searchId = useId();
  const filledOnlyId = useId();
  const [query, setQuery] = useState("");
  const [showFilledOnly, setShowFilledOnly] = useState(false);

  const searchFilteredGroups = useMemo(
    () => filterComparisonGroups(groups, query),
    [groups, query],
  );
  const filteredGroups = useMemo(() => {
    if (!showFilledOnly) {
      return searchFilteredGroups;
    }

    return searchFilteredGroups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) =>
          row.values.some((cell) => {
            if (typeof cell.value === "boolean") {
              return cell.value;
            }

            const trimmedValue = cell.value.trim();
            if (trimmedValue === "" || trimmedValue === "-") {
              return false;
            }

            return trimmedValue !== "0";
          }),
        ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [searchFilteredGroups, showFilledOnly]);
  const totalRows = useMemo(() => countComparisonRows(groups), [groups]);
  const visibleRows = useMemo(
    () => countComparisonRows(filteredGroups),
    [filteredGroups],
  );

  const trimmedQuery = query.trim();
  const isFiltering = trimmedQuery.length > 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 px-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:border-kv-border sm:bg-kv-bg/40 sm:p-4">
        <label htmlFor={searchId} className="sr-only">
          Zoek specificaties
        </label>
        <div className="relative w-full sm:flex-1">
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
        <label
          htmlFor={filledOnlyId}
          className="inline-flex cursor-pointer items-center gap-3 text-sm text-kv-navy sm:rounded-xl sm:border sm:border-kv-border sm:bg-kv-surface sm:px-3 sm:py-2 sm:transition-colors sm:hover:border-kv-teal/50"
        >
          <input
            id={filledOnlyId}
            type="checkbox"
            checked={showFilledOnly}
            onChange={(event) => setShowFilledOnly(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 rounded-full bg-kv-border shadow-inner transition-colors duration-200 peer-checked:bg-kv-teal peer-focus-visible:ring-2 peer-focus-visible:ring-kv-teal/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-kv-surface"
          >
            <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-kv-surface shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
          </span>
          <span className="sm:hidden">Alleen ingevuld</span>
          <span className="hidden sm:inline">Toon alleen ingevulde rijen</span>
        </label>
      </div>
      {(isFiltering || showFilledOnly) && (
        <p className="px-3 text-sm text-kv-muted sm:px-0" role="status" aria-live="polite">
          {visibleRows === 0
            ? "Geen specificaties gevonden"
            : `${visibleRows} van ${totalRows} specificaties`}
        </p>
      )}

      {visibleRows === 0 && (isFiltering || showFilledOnly) ? (
        <p className="mx-3 rounded-xl border border-kv-border bg-kv-bg/60 px-4 py-6 text-center text-sm text-kv-muted sm:mx-0">
          {isFiltering
            ? `Geen specificaties gevonden voor "${trimmedQuery}". Probeer een andere zoekterm of een groepsnaam zoals "Veiligheid".`
            : "Geen ingevulde specificaties gevonden. Zet de filter uit om alle rijen te tonen."}
        </p>
      ) : (
        <ComparisonTable
          kentekens={kentekens}
          groups={filteredGroups}
          caption={caption}
          stickyPlates={stickyPlates}
        />
      )}
    </div>
  );
}
