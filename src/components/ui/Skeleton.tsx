import { cn } from "@/lib/cn";

/**
 * A single pulsing placeholder block — the building unit every page-shaped
 * skeleton is composed from. Uses the same surface-sunken tone as real
 * "empty" UI elsewhere (inputs, sunken panels) so it reads as "content on
 * its way" rather than a stray gray box that looks broken.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-sunken", className)} />;
}
