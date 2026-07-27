import { Outlet } from "react-router-dom";
import { BottomNav } from "@/components/layout/BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[430px] mx-auto min-h-screen relative pb-24">
        <Outlet />
        <BottomNav />
      </div>
    </div>
  );
}
