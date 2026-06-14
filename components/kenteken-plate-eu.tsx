const STAR =
  "M0,-1.15 0.336,-0.355 1.093,-0.355 0.438,0.135 0.676,0.93 0,0.44 -0.676,0.93 -0.438,0.135 -1.093,-0.355 -0.336,-0.355";

const STAR_POSITIONS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * 30 - 90) * (Math.PI / 180);
  return {
    x: 12 + 7 * Math.cos(angle),
    y: 10 + 7 * Math.sin(angle),
    rotation: index * 30 + 180,
  };
});

type KentekenPlateEuStripProps = {
  size?: "default" | "chip";
};

export function KentekenPlateEuStrip({ size = "default" }: KentekenPlateEuStripProps) {
  return (
    <div
      aria-hidden="true"
      className={size === "chip" ? "kv-plate-eu kv-plate-eu--chip" : "kv-plate-eu"}
    >
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
