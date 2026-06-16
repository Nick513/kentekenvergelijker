"use client";

import { useState, type ReactNode } from "react";
import { KentekenPlateChip } from "@/components/kenteken-plate-chip";
import { SpecVerificationModal } from "@/components/spec-verification-modal";
import type { SpecVerification } from "@/lib/enrichment/types";
import { cellIsUnverifiedForDisplay } from "@/lib/specifications/resolve";

export type ComparisonCellValue = string | boolean;

export type ComparisonCell = {
  value: ComparisonCellValue;
  verification?: SpecVerification | null;
};

export type ComparisonRow = {
  label: string;
  values: ComparisonCell[];
};

export type ComparisonGroup = {
  title: string;
  rows: ComparisonRow[];
};

type ComparisonTableProps = {
  kentekens: string[];
  groups: ComparisonGroup[];
  caption?: string;
};

const SPEC_COLUMN_WIDTH = "11rem";
/** Minimum per kenteken column before the table scrolls horizontally. */
const PLATE_COLUMN_MIN_WIDTH = "7rem";

const SPEC_COLUMN_CLASS =
  "sticky left-0 z-10 w-[11rem] max-w-[11rem] border-r border-kv-border/40 bg-inherit px-3 shadow-[4px_0_8px_-4px_rgb(17_17_17_/_10%)]";
const PLATE_COLUMN_CLASS =
  "min-w-0 px-3 align-top break-words [overflow-wrap:anywhere]";

function UnverifiedValueHint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className="mt-1 block text-xs font-normal text-kv-muted">
        Ongeverifieerd{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline decoration-kv-teal/60 underline-offset-2 hover:text-kv-teal"
        >
          Wat betekent dit?
        </button>
      </span>
      <SpecVerificationModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ComparisonCellContent({ cell }: { cell: ComparisonCell }) {
  const { value } = cell;
  const showUnverifiedHint = cellIsUnverifiedForDisplay(cell);

  let content: ReactNode;

  if (typeof value === "boolean") {
    content = value ? (
      <span className="font-bold text-kv-green" aria-label="Ja">
        ✓
      </span>
    ) : (
      <span className="text-kv-muted" aria-label="Nee">
        -
      </span>
    );
  } else if (value === "-") {
    content = <span className="text-kv-muted">-</span>;
  } else {
    content = (
      <span className="block break-words text-kv-navy [overflow-wrap:anywhere]">
        {value}
      </span>
    );
  }

  return (
    <>
      {content}
      {showUnverifiedHint ? <UnverifiedValueHint /> : null}
    </>
  );
}

function rowBackgroundClass(rowIndex: number): string {
  return rowIndex % 2 === 0 ? "bg-kv-surface" : "bg-kv-bg/60";
}

export function ComparisonTable({ kentekens, groups, caption }: ComparisonTableProps) {
  const columnCount = kentekens.length + 1;
  const tableMinWidth = `max(100%, calc(${SPEC_COLUMN_WIDTH} + ${kentekens.length} * ${PLATE_COLUMN_MIN_WIDTH}))`;

  return (
    <div className="kv-comparison-table-scroll w-full overflow-x-auto rounded-xl border border-kv-border">
      <table
        className="w-full table-fixed border-collapse text-left text-sm"
        style={{ minWidth: tableMinWidth }}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <colgroup>
          <col style={{ width: SPEC_COLUMN_WIDTH }} />
          {kentekens.map((kenteken) => (
            <col key={kenteken} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-kv-navy-bg text-white">
            <th
              scope="col"
              className={`${SPEC_COLUMN_CLASS} z-20 bg-kv-navy-bg py-3.5 font-semibold text-white/70`}
            >
              Specificatie
            </th>
            {kentekens.map((kenteken) => (
              <th
                key={kenteken}
                scope="col"
                className={`${PLATE_COLUMN_CLASS} py-3.5 font-semibold`}
              >
                <KentekenPlateChip kenteken={kenteken} />
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr className="bg-kv-bg-alt">
              <th
                colSpan={columnCount}
                scope="colgroup"
                className="border-t border-kv-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-kv-teal"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row, rowIndex) => {
              const rowClass = rowBackgroundClass(rowIndex);

              return (
                <tr key={row.label} className={rowClass}>
                  <th
                    scope="row"
                    className={`${SPEC_COLUMN_CLASS} ${rowClass} border-t border-kv-border py-3 pl-5 font-medium break-words text-kv-navy [overflow-wrap:anywhere]`}
                  >
                    {row.label}
                  </th>
                  {row.values.map((cell, valueIndex) => (
                    <td
                      key={`${row.label}-${kentekens[valueIndex]}`}
                      className={`${PLATE_COLUMN_CLASS} border-t border-kv-border py-3`}
                    >
                      <ComparisonCellContent cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export function sliceComparisonGroups(
  groups: ComparisonGroup[],
  kentekenCount: number,
): ComparisonGroup[] {
  return groups.map((group) => ({
    title: group.title,
    rows: group.rows.map((row) => ({
      label: row.label,
      values: row.values.slice(0, kentekenCount),
    })),
  }));
}

export function countComparisonRows(groups: ComparisonGroup[]): number {
  return groups.reduce((total, group) => total + group.rows.length, 0);
}

export function filterComparisonGroups(
  groups: ComparisonGroup[],
  query: string,
): ComparisonGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return groups;
  }

  return groups
    .map((group) => {
      const groupMatches = group.title.toLowerCase().includes(normalized);
      const rows = groupMatches
        ? group.rows
        : group.rows.filter((row) =>
            row.label.toLowerCase().includes(normalized),
          );

      return { ...group, rows };
    })
    .filter((group) => group.rows.length > 0);
}
