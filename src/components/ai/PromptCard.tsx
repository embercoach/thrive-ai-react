import type { LucideIcon } from "lucide-react";

interface PromptCardProps {
  text: string;
  icon: LucideIcon;
  colorVar: string; // e.g. "var(--color-negative)"
  onClick: () => void;
}

export function PromptCard({ text, icon: Icon, colorVar, onClick }: PromptCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-surface border border-border rounded-2xl p-3 flex flex-col gap-2.5 cursor-pointer transition-colors hover:border-border-strong"
    >
      <div
        className="w-6.5 h-6.5 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `color-mix(in srgb, ${colorVar} 16%, transparent)` }}
      >
        <Icon size={13} color={colorVar} />
      </div>
      <span className="text-sm font-medium text-ink leading-snug">{text}</span>
    </button>
  );
}
