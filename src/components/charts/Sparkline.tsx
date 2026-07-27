interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
}

/** A minimal trend line. Color follows the first-vs-last point direction —
 * green for up, red for down — never the brand color, per the "green/red
 * are the only signal colors" rule established for this app. */
export function Sparkline({ points, width = 60, height = 28 }: SparklineProps) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const trendUp = points[points.length - 1] >= points[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={coords}
        fill="none"
        stroke={trendUp ? "var(--color-positive)" : "var(--color-negative)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
