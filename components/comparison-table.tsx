import { KentekenPlateChip } from "@/components/kenteken-plate-chip";

export type ComparisonCellValue = string | boolean;

export type ComparisonRow = {
  label: string;
  values: ComparisonCellValue[];
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

const SPEC_COLUMN_CLASS =
  "sticky left-0 z-10 min-w-[11rem] max-w-[14rem] border-r border-kv-border/40 bg-inherit px-4 shadow-[4px_0_8px_-4px_rgb(17_17_17_/_10%)]";
const PLATE_COLUMN_CLASS = "min-w-[9.5rem] whitespace-nowrap px-4";

function ComparisonCell({ value }: { value: ComparisonCellValue }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="font-bold text-kv-green" aria-label="Ja">
        ✓
      </span>
    ) : (
      <span className="text-kv-muted" aria-label="Nee">
        -
      </span>
    );
  }

  if (value === "-") {
    return <span className="text-kv-muted">-</span>;
  }

  return <span className="text-kv-navy">{value}</span>;
}

function rowBackgroundClass(rowIndex: number): string {
  return rowIndex % 2 === 0 ? "bg-kv-surface" : "bg-kv-bg/60";
}

export function ComparisonTable({ kentekens, groups, caption }: ComparisonTableProps) {
  const columnCount = kentekens.length + 1;

  return (
    <div className="kv-comparison-table-scroll overflow-x-auto rounded-xl border border-kv-border">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
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
                    className={`${SPEC_COLUMN_CLASS} ${rowClass} border-t border-kv-border py-3 pl-6 font-medium text-kv-navy`}
                  >
                    {row.label}
                  </th>
                  {row.values.map((value, valueIndex) => (
                    <td
                      key={`${row.label}-${kentekens[valueIndex]}`}
                      className={`${PLATE_COLUMN_CLASS} border-t border-kv-border py-3`}
                    >
                      <ComparisonCell value={value} />
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
