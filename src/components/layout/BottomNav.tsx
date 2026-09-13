import { NavLink } from "react-router-dom";
import { Home, PieChart, Sparkles, Target, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/hooks/useI18n";

export function BottomNav() {
  const t = useT();
  const TABS = [
    { to: "/", label: t("nav.home"), icon: Home, end: true },
    { to: "/spending", label: t("nav.spending"), icon: PieChart, end: false },
    { to: "/ai", label: t("nav.ai"), icon: Sparkles, end: false },
    { to: "/goals", label: t("nav.goals"), icon: Target, end: false },
    { to: "/profile", label: t("nav.profile"), icon: User, end: false },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] flex bg-surface/95 backdrop-blur-xl border-t border-border pt-2 pb-6 z-40">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="flex-1 flex flex-col items-center gap-1 pt-1"
        >
          {({ isActive }) => (
            <>
              <Icon
                size={20}
                className={cn(
                  "transition-transform",
                  isActive ? "text-brand scale-110" : "text-ink-muted"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold",
                  isActive ? "text-brand" : "text-ink-muted"
                )}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
