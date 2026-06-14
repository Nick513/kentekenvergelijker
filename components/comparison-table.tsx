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

export function ComparisonTable({ kentekens, groups, caption }: ComparisonTableProps) {
  const columnCount = kentekens.length + 1;

  return (
    <div className="overflow-x-auto rounded-xl border border-kv-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-kv-navy-bg text-white">
            <th scope="col" className="px-4 py-3.5 font-semibold text-white/70">
              Specificatie
            </th>
            {kentekens.map((kenteken) => (
              <th key={kenteken} scope="col" className="px-4 py-3.5 font-semibold">
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
            {group.rows.map((row, rowIndex) => (
              <tr
                key={row.label}
                className={rowIndex % 2 === 0 ? "bg-kv-surface" : "bg-kv-bg/60"}
              >
                <th
                  scope="row"
                  className="border-t border-kv-border px-4 py-3 pl-6 font-medium text-kv-navy"
                >
                  {row.label}
                </th>
                {row.values.map((value, valueIndex) => (
                  <td
                    key={`${row.label}-${kentekens[valueIndex]}`}
                    className="border-t border-kv-border px-4 py-3"
                  >
                    <ComparisonCell value={value} />
                  </td>
                ))}
              </tr>
            ))}
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
