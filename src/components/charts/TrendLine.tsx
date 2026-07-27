import { formatMoneyCompact } from "@/lib/currency";

interface TrendLineProps {
  points: number[]; // cumulative values, oldest to newest
  labels: string[]; // one per point
  currency?: string;
  width?: number;
  height?: number;
}

export function TrendLine({ points, labels, currency = "USD", width = 280, height = 90 }: TrendLineProps) {
  const maxVal = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const coords = points
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / maxVal) * height).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between flex-shrink-0" style={{ height }}>
          {[4, 3, 2, 1, 0].map((i) => (
            <span key={i} className="text-xs text-ink-muted">
              {formatMoneyCompact((maxVal * i) / 4, currency)}
            </span>
          ))}
        </div>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={coords}
            fill="none"
            stroke="var(--color-positive)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex justify-between mt-1 pl-10">
        {labels.map((l, i) => (
          <span key={i} className="text-xs text-ink-muted">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
