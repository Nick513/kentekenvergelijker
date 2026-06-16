const STAR =
  "M0,-1.15 0.336,-0.355 1.093,-0.355 0.438,0.135 0.676,0.93 0,0.44 -0.676,0.93 -0.438,0.135 -1.093,-0.355 -0.336,-0.355";

const STAR_POSITIONS = [
  { x: 12, y: 3, rotation: 180 },
  { x: 15.5, y: 3.938, rotation: 210 },
  { x: 18.062, y: 6.5, rotation: 240 },
  { x: 19, y: 10, rotation: 270 },
  { x: 18.062, y: 13.5, rotation: 300 },
  { x: 15.5, y: 16.062, rotation: 330 },
  { x: 12, y: 17, rotation: 360 },
  { x: 8.5, y: 16.062, rotation: 390 },
  { x: 5.938, y: 13.5, rotation: 420 },
  { x: 5, y: 10, rotation: 450 },
  { x: 5.938, y: 6.5, rotation: 480 },
  { x: 8.5, y: 3.938, rotation: 510 },
] as const;

type KentekenPlateEuStripProps = {
  size?: "default" | "chip" | "compact";
};

export function KentekenPlateEuStrip({ size = "default" }: KentekenPlateEuStripProps) {
  const sizeClass =
    size === "compact"
      ? "kv-plate-eu kv-plate-eu--compact"
      : size === "chip"
        ? "kv-plate-eu kv-plate-eu--chip"
        : "kv-plate-eu";

  return (
    <div aria-hidden="true" className={sizeClass}>
      <svg className="kv-plate-eu-stars" viewBox="0 0 24 20" aria-hidden="true">
        <g fill="currentColor">
          {STAR_POSITIONS.map((star) => (
            <path
              key={star.rotation}
              d={STAR}
              transform={`translate(${star.x} ${star.y}) rotate(${star.rotation}) scale(0.42)`}
            />
          ))}
        </g>
      </svg>
      <span className="kv-plate-eu-code">NL</span>
    </div>
  );
}
