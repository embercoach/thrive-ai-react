import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "@/components/layout/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function AppLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[430px] mx-auto min-h-screen relative pb-24">
        {/* Keyed by path so navigating to a different tab remounts a fresh,
            un-crashed boundary — the bottom nav below stays outside it and
            always stays usable, so a broken page is never a dead end. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
        <BottomNav />
      </div>
    </div>
  );
}
