import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  elevated?: boolean;
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/**
 * The single card surface used everywhere: hero, brief, bills, goals,
 * transaction lists, chat bubbles. Keeping one primitive (rather than a
 * bespoke class per screen) is what keeps the whole app feeling like one
 * product instead of a collection of similar-but-not-quite-matching cards.
 */
export function Card({
  children,
  padding = "lg",
  interactive = false,
  elevated = false,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-2xl",
        elevated ? "shadow-elevated" : "shadow-card",
        paddingMap[padding],
        interactive && "cursor-pointer transition-colors hover:border-border-strong active:scale-[0.99]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
