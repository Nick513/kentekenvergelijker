import { KentekenPlateEuStrip } from "@/components/kenteken-plate-eu";

type KentekenPlateChipProps = {
  kenteken: string;
  compact?: boolean;
};

export function KentekenPlateChip({ kenteken, compact = false }: KentekenPlateChipProps) {
  return (
    <span className={compact ? "kv-plate-chip kv-plate-chip--compact" : "kv-plate-chip"}>
      <KentekenPlateEuStrip size={compact ? "compact" : "chip"} />
      <span className="kv-plate-chip-text">{kenteken}</span>
    </span>
  );
}
