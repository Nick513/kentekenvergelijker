"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  note?: string;
  variant?: "market";
};

type ComparisonTableProps = {
  kentekens: string[];
  groups: ComparisonGroup[];
  caption?: string;
  stickyPlates?: boolean;
};

const SPEC_COLUMN_WIDTH = "11rem";
/** Minimum per kenteken column before the table scrolls horizontally. */
const PLATE_COLUMN_MIN_WIDTH = "7rem";

const SPEC_COLUMN_STICKY =
  "sticky left-0 z-10 w-[11rem] max-w-[11rem] px-3 shadow-[4px_0_8px_-4px_rgb(17_17_17_/_10%)]";
const SPEC_COLUMN_BODY_CLASS = `${SPEC_COLUMN_STICKY} border-r border-kv-border/40 bg-inherit`;
const PLATE_COLUMN_CLASS =
  "min-w-0 px-3 align-top break-words [overflow-wrap:anywhere]";

function readSiteHeaderHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--kv-header-height",
  );
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 80;
}

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

type StickyPlateBarProps = {
  kentekens: string[];
  tableMinWidth: string;
  scrollLeft: number;
  geometry: { left: number; width: number };
};

function StickyPlateBar({
  kentekens,
  tableMinWidth,
  scrollLeft,
  geometry,
}: StickyPlateBarProps) {
  return (
    <div
      className="kv-comparison-sticky-plates fixed z-40"
      style={{
        top: "var(--kv-header-height)",
        left: geometry.left,
        width: geometry.width,
      }}
      aria-hidden="true"
    >
      <div
        className="kv-comparison-sticky-plates-track"
        style={{ minWidth: tableMinWidth, transform: `translateX(-${scrollLeft}px)` }}
      >
        <div className="kv-comparison-sticky-plates-spacer" />
        {kentekens.map((kenteken) => (
          <div key={kenteken} className="kv-comparison-sticky-plates-cell">
            <KentekenPlateChip kenteken={kenteken} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparisonTable({
  kentekens,
  groups,
  caption,
  stickyPlates = false,
}: ComparisonTableProps) {
  const columnCount = kentekens.length + 1;
  const tableMinWidth = `max(100%, calc(${SPEC_COLUMN_WIDTH} + ${kentekens.length} * ${PLATE_COLUMN_MIN_WIDTH}))`;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [showStickyPlates, setShowStickyPlates] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [barGeometry, setBarGeometry] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!stickyPlates) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const updateGeometry = () => {
      const rect = scrollContainer.getBoundingClientRect();
      setBarGeometry({ left: rect.left, width: rect.width });
    };

    updateGeometry();

    const resizeObserver = new ResizeObserver(updateGeometry);
    resizeObserver.observe(scrollContainer);
    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry);
    };
  }, [stickyPlates]);

  useEffect(() => {
    if (!stickyPlates) {
      return;
    }

    const headerRow = headerRowRef.current;
    if (!headerRow) {
      return;
    }

    let observer: IntersectionObserver | null = null;

    const connect = () => {
      observer?.disconnect();

      const siteHeaderHeight = readSiteHeaderHeight();
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry) {
            setShowStickyPlates(!entry.isIntersecting);
          }
        },
        {
          root: null,
          rootMargin: `-${siteHeaderHeight}px 0px 0px 0px`,
          threshold: 0,
        },
      );
      observer.observe(headerRow);
    };

    connect();
    window.addEventListener("resize", connect);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", connect);
    };
  }, [groups, kentekens, stickyPlates]);

  const handleTableScroll = () => {
    if (!stickyPlates) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    setScrollLeft(scrollContainer.scrollLeft);
  };

  return (
    <>
      {stickyPlates && showStickyPlates && barGeometry.width > 0 ? (
        <StickyPlateBar
          kentekens={kentekens}
          tableMinWidth={tableMinWidth}
          scrollLeft={scrollLeft}
          geometry={barGeometry}
        />
      ) : null}

      <div
        ref={scrollContainerRef}
        onScroll={stickyPlates ? handleTableScroll : undefined}
        className="kv-comparison-table-scroll w-full overflow-x-auto rounded-xl border border-kv-border"
      >
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
        <thead className="kv-comparison-thead">
          <tr ref={headerRowRef}>
            <th scope="col" className="kv-comparison-thead-spec relative">
              Specificatie
            </th>
            {kentekens.map((kenteken) => (
              <th key={kenteken} scope="col" className="kv-comparison-thead-plate">
                <KentekenPlateChip kenteken={kenteken} />
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => {
          const isMarket = group.variant === "market";
          return (
            <tbody key={group.title}>
              <tr>
                <th
                  colSpan={columnCount}
                  scope="colgroup"
                  className={
                    isMarket
                      ? "border-t-2 border-kv-teal/50 bg-kv-teal/10 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-kv-teal"
                      : "border-t border-kv-teal/20 bg-kv-bg-alt px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-kv-teal"
                  }
                >
                  {group.title}
                  {group.note ? (
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-kv-muted">
                      {group.note}
                    </span>
                  ) : null}
                </th>
              </tr>
              {group.rows.map((row, rowIndex) => {
                const rowClass = rowBackgroundClass(rowIndex);
                const borderClass = "border-t border-kv-border";

                return (
                  <tr key={row.label} className={rowClass}>
                    <th
                      scope="row"
                      className={`${SPEC_COLUMN_BODY_CLASS} ${rowClass} ${borderClass} py-3 pl-5 font-medium break-words text-kv-navy [overflow-wrap:anywhere]`}
                    >
                      {row.label}
                    </th>
                    {row.values.map((cell, valueIndex) => (
                      <td
                        key={`${row.label}-${kentekens[valueIndex]}`}
                        className={`${PLATE_COLUMN_CLASS} ${borderClass} py-3`}
                      >
                        <ComparisonCellContent cell={cell} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
      </div>
    </>
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
