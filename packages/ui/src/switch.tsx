"use client";

import { ReactNode } from "react";
import { cn } from "@sglara/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Switch = ({ 
  checked, 
  onCheckedChange, 
  disabled = false, 
  className,
  size = "md"
}: SwitchProps) => {
  const sizeClasses = {
    sm: "h-4 w-7",
    md: "h-5 w-9", 
    lg: "h-6 w-11"
  };

  const thumbSizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const translateClasses = {
    sm: checked ? "translate-x-3" : "translate-x-0",
    md: checked ? "translate-x-4" : "translate-x-0", 
    lg: checked ? "translate-x-5" : "translate-x-0"
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent-500" : "bg-neutral-700",
        sizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform",
          thumbSizeClasses[size],
          translateClasses[size]
        )}
      />
    </button>
  );
};
