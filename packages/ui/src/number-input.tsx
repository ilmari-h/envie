"use client";

import { ReactNode } from "react";
import { cn } from "@sglara/cn";
import { Plus, Minus } from "lucide-react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export const NumberInput = ({ 
  value, 
  onChange, 
  min = 0, 
  max = 999, 
  step = 1,
  disabled = false,
  className,
  icon,
  size = "md"
}: NumberInputProps) => {
  const handleIncrement = () => {
    if (!disabled && value < max) {
      onChange(value + step);
    }
  };

  const handleDecrement = () => {
    if (!disabled && value > min) {
      onChange(value - step);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min;
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  const sizeClasses = {
    sm: {
      container: "h-8",
      button: "w-6 h-6",
      input: "w-12 text-xs",
      icon: "w-3 h-3"
    },
    md: {
      container: "h-10",
      button: "w-8 h-8",
      input: "w-16 text-sm",
      icon: "w-4 h-4"
    },
    lg: {
      container: "h-12",
      button: "w-10 h-10",
      input: "w-20 text-base",
      icon: "w-5 h-5"
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("flex items-center gap-2", currentSize.container)}>
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className={cn(
            "inline-flex items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:pointer-events-none disabled:opacity-50",
            "bg-neutral-800 hover:bg-neutral-700 border-neutral-700 hover:border-neutral-600",
            "disabled:bg-neutral-900 disabled:border-neutral-900",
            currentSize.button
          )}
        >
          <Minus className={cn("text-neutral-400", currentSize.icon)} />
        </button>
        
        <div className={cn(
          "flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-md px-3 py-2",
          currentSize.container
        )}>
          {icon && (
            <div className={cn("text-neutral-400", currentSize.icon)}>
              {icon}
            </div>
          )}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            className={cn(
              "bg-transparent text-center text-neutral-100 focus:outline-none font-mono disabled:cursor-not-allowed disabled:opacity-50",
              currentSize.input
            )}
          />
        </div>
        
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className={cn(
            "inline-flex items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 disabled:pointer-events-none disabled:opacity-50",
            "bg-neutral-800 hover:bg-neutral-700 border-neutral-700 hover:border-neutral-600",
            "disabled:bg-neutral-900 disabled:border-neutral-900",
            currentSize.button
          )}
        >
          <Plus className={cn("text-neutral-400", currentSize.icon)} />
        </button>
      </div>
    </div>
  );
};
