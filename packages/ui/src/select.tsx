"use client";

import { cn } from "@sglara/cn";

interface SelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  className?: string;
  variant?: "regular" | "accent" | "destructive";
  placeholder?: string;
  allowNone?: boolean;
}

export const Select = ({ value, onChange, options, className, variant = "regular", placeholder, allowNone = false }: SelectProps) => {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className={cn(
        "text-xs px-3 py-2 rounded border transition-colors appearance-none bg-right bg-no-repeat",
        variant === "accent" && "bg-purple-900/[.3] hover:bg-purple-900 border-purple-900",
        variant === "destructive" && "bg-red-900/[.3] hover:bg-red-900 border-red-900",
        variant === "regular" && "bg-neutral-900 hover:bg-neutral-800 border-neutral-800",
        className
      )}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}

      {allowNone && (
        <option key="none" value="" className="text-neutral-400">
          None
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
