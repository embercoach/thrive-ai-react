import type { ReactNode } from "react";

interface CardHeaderProps {
  title: string;
  action?: ReactNode;
  onActionClick?: () => void;
}

export function CardHeader({ title, action, onActionClick }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="font-sans text-[16px] font-bold text-ink">{title}</h3>
      {action && (
        <button onClick={onActionClick} className="text-xs font-semibold text-brand cursor-pointer">
          {action}
        </button>
      )}
    </div>
  );
}
