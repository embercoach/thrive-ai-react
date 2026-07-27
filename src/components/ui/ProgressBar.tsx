import { cn } from "@/lib/cn";

interface ProgressBarProps {
  percent: number; // 0-100, clamped
  color?: string;
  className?: string;
}

export function ProgressBar({ percent, color = "var(--color-positive)", className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <div className={cn("h-1.5 rounded-full bg-surface-sunken overflow-hidden", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${clamped}%`,
          backgroundColor: color,
          transitionTimingFunction: "var(--ease-standard)",
        }}
      />
    </div>
  );
}
