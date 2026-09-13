import { Bell } from "lucide-react";
import { useT } from "@/hooks/useI18n";

interface TopBarProps {
  greeting: string;
  onBellClick?: () => void;
}

export function TopBar({ greeting, onBellClick }: TopBarProps) {
  const t = useT();
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-1">
      <h1 className="font-sans text-xl font-bold text-ink tracking-tight">{greeting}</h1>
      <button onClick={onBellClick} aria-label={t("home.notificationsAria")} className="text-ink-secondary cursor-pointer">
        <Bell size={20} />
      </button>
    </div>
  );
}
