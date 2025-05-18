"use client";

import { ReactNode } from "react";
import { cn } from "@sglara/cn";

interface ButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode | string;
  className?: string;
  icon?: ReactNode;
  variant?: "regular" | "accent" | "destructive";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export const Button = ({ children, className, icon, onClick, disabled, type, ...props }: ButtonProps) => {
  const variant = props.variant || "regular";
  return (
    <button 
      className={cn(
        "flex text-xs items-center justify-center gap-2 px-3 py-2 rounded border transition-colors",
        variant === "accent" && "bg-accent-900/[.3] hover:bg-accent-900 border-accent-900",
        variant === "destructive" && "bg-red-900/[.3] hover:bg-red-900 border-red-900",
        variant === "regular" && "bg-neutral-900 hover:bg-neutral-800 border-neutral-800",
        disabled && "opacity-50 cursor-default hover:bg-neutral-900",
        className
      )}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {icon}
      {children}
    </button>
  );
};
