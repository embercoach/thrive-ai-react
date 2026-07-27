import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed,
  Home,
  Car,
  Film,
  Pill,
  Smartphone,
  Briefcase,
  Wallet,
  ShoppingBag,
  Shirt,
  Book,
  Dumbbell,
  Baby,
  Plane,
  Zap,
  Shield,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Food: UtensilsCrossed,
  Housing: Home,
  Transport: Car,
  Entertainment: Film,
  Health: Pill,
  Subscriptions: Smartphone,
  Income: Briefcase,
  Salary: Briefcase,
  Other: Wallet,
  Shopping: ShoppingBag,
  Clothing: Shirt,
  Education: Book,
  Gym: Dumbbell,
  Kids: Baby,
  Travel: Plane,
  Utilities: Zap,
  Insurance: Shield,
};

export const CATEGORY_COLORS: Record<string, string> = {
  Food: "var(--color-cat-food)",
  Housing: "var(--color-cat-housing)",
  Transport: "var(--color-cat-transport)",
  Entertainment: "var(--color-cat-entertainment)",
  Health: "var(--color-cat-health)",
  Subscriptions: "var(--color-cat-transport)",
  Income: "var(--color-cat-income)",
  Salary: "var(--color-cat-income)",
  Other: "var(--color-cat-other)",
  Shopping: "var(--color-cat-shopping)",
  Clothing: "var(--color-cat-entertainment)",
  Education: "var(--color-cat-transport)",
  Gym: "var(--color-cat-food)",
  Kids: "var(--color-cat-health)",
  Travel: "var(--color-cat-transport)",
  Utilities: "var(--color-cat-housing)",
  Insurance: "var(--color-cat-other)",
};

export function categoryIcon(category?: string | null): LucideIcon {
  return CATEGORY_ICONS[category ?? "Other"] ?? Wallet;
}

// Curated colors for known categories read cleanly against the dark canvas.
// Anything outside that list (a category the user typed themselves) gets a
// color derived from its own name instead of falling back to a shared gray —
// two different custom categories should never look identical in a chart.
function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function categoryColor(category?: string | null): string {
  const key = category ?? "Other";
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  const hue = hashHue(key);
  return `hsl(${hue}, 55%, 58%)`;
}
