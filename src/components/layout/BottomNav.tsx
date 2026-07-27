import { NavLink } from "react-router-dom";
import { Home, PieChart, Sparkles, Target, User } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/spending", label: "Spending", icon: PieChart, end: false },
  { to: "/ai", label: "AI", icon: Sparkles, end: false },
  { to: "/goals", label: "Goals", icon: Target, end: false },
  { to: "/profile", label: "Profile", icon: User, end: false },
];

export function BottomNav() {
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
