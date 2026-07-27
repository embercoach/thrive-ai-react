import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "danger" | "info" | "success";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-ink-on-brand hover:bg-brand-strong font-bold",
  outline: "bg-transparent border border-border-strong text-ink hover:bg-surface-sunken",
  ghost: "bg-transparent text-ink-secondary hover:text-ink",
  danger: "bg-negative/10 text-negative border border-negative/30 hover:bg-negative/15",
  info: "bg-info/10 text-info border border-info/30 hover:bg-info/15",
  success: "bg-brand/12 text-brand border border-brand/30 hover:bg-brand/18",
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-3.5 text-sm rounded-2xl",
  sm: "px-3.5 py-2 text-xs rounded-xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
