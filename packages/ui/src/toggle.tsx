"use client";

import { cn } from "@sglara/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer", className)}>
      {label && <span className="text-xs text-neutral-400">{label}</span>}
      <div
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          checked ? "bg-accent-900" : "bg-neutral-800"
        )}
        onClick={() => onChange(!checked)}
      >
        <div
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
    </label>
  );
}
