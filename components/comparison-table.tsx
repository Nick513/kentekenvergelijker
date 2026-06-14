import { KentekenPlateChip } from "@/components/kenteken-plate-chip";

export type ComparisonCellValue = string | boolean;

type ComparisonTableProps = {
  kentekens: string[];
  rows: { label: string; values: ComparisonCellValue[] }[];
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

  return <span className="text-kv-navy">{value}</span>;
}

export function ComparisonTable({ kentekens, rows, caption }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-kv-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-kv-navy text-white">
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
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.label}
              className={rowIndex % 2 === 0 ? "bg-kv-surface" : "bg-kv-bg/60"}
            >
              <th
                scope="row"
                className="border-t border-kv-border px-4 py-3 font-medium text-kv-navy"
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
      </table>
    </div>
  );
}
