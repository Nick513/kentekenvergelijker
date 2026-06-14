import { KentekenPlateEuStrip } from "@/components/kenteken-plate-eu";

type KentekenPlateChipProps = {
  kenteken: string;
};

export function KentekenPlateChip({ kenteken }: KentekenPlateChipProps) {
  return (
    <span className="kv-plate-chip">
      <KentekenPlateEuStrip size="chip" />
      <span className="kv-plate-chip-text">{kenteken}</span>
    </span>
  );
}
