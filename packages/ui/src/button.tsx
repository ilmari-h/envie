"use client";

import { ReactNode } from "react";
import { cn } from "@sglara/cn";

interface ButtonProps {
  onClick?: () => void;
  children: ReactNode | string;
  className?: string;
  icon?: ReactNode;
  variant?: "regular" | "accent" | "destructive";
}

export const Button = ({ children, className, icon, onClick, variant }: ButtonProps) => {
  return (
    <button 
      className={cn(
        "flex text-xs items-center justify-center gap-2 px-3 py-2 rounded border transition-colors",
        variant === "accent" && "bg-purple-900/[.3] hover:bg-purple-900 border-purple-900",
        variant === "destructive" && "bg-red-900/[.3] hover:bg-red-900 border-red-900",
        variant === "regular" && "bg-neutral-900 hover:bg-neutral-800 border-neutral-800",
        className
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
};
