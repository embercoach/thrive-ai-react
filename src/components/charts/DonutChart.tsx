interface DonutSegment {
  category: string;
  amount: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function DonutChart({ segments, total, size = 104, strokeWidth = 12 }: DonutChartProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  if (total <= 0 || segments.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
      </svg>
    );
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {segments.map((seg) => {
        const frac = seg.amount / total;
        const len = frac * c;
        const dash = `${len.toFixed(1)} ${(c - len).toFixed(1)}`;
        const dashOffset = -offset;
        offset += len;
        return (
          <circle
            key={seg.category}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
      })}
    </svg>
  );
}
