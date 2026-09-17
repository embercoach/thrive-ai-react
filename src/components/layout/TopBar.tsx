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
      <button
        onClick={onBellClick}
        aria-label={t("home.notificationsAria")}
        // p-2 -m-2 grows the tap target to ~36px without shifting the
        // icon's visual position or the row's spacing.
        className="text-ink-secondary cursor-pointer p-2 -m-2"
      >
        <Bell size={20} />
      </button>
    </div>
  );
}
