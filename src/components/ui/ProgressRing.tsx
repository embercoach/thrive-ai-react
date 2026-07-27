interface ProgressRingProps {
  percent: number; // 0-100, values above 100 are clamped for the arc but not the label
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  labelSize?: number;
}

/**
 * A single reusable ring. The percentage label is rendered as real SVG
 * text so it's always perfectly centered regardless of ring size —
 * every screen that needs "a ring with a number in it" uses this same
 * component rather than each screen hand-rolling its own circle math.
 */
export function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 5,
  color = "var(--color-positive)",
  trackColor = "var(--color-border)",
  label,
  labelSize = 15,
}: ProgressRingProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={center} cy={center} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dasharray 0.6s var(--ease-standard)" }}
      />
      {label !== undefined && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={labelSize}
          fontWeight={800}
          fill="var(--color-ink)"
          fontFamily="var(--font-sans)"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
