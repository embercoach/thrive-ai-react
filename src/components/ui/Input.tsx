import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...rest }: InputProps) {
  return (
    <div className="mb-3">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none",
          "placeholder:text-ink-muted focus:border-brand transition-colors",
          className
        )}
        {...rest}
      />
    </div>
  );
}
