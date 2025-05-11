"use client";

import { cn } from "@sglara/cn";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  variant?: "regular" | "accent" | "destructive";
  placeholder?: string;
}

export const Select = ({ value, onChange, options, className, variant = "regular", placeholder }: SelectProps) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
