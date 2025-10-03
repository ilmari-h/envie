"use client";

import { forwardRef } from "react";
import { cn } from "@sglara/cn";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: "sm" | "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, disabled = false, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm", 
      lg: "h-12 px-4 text-base"
    };

    return (
      <div className="relative group">
        <input
          className={cn(
            "relative w-full rounded-lg border px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-neutral-900 border-neutral-800 focus:border-accent-500/30",
            sizeClasses[size],
            disabled && "opacity-50 cursor-default",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
