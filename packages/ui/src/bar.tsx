import { ReactNode, PropsWithChildren } from "react";
import { cn } from "@sglara/cn";
interface BarProps extends PropsWithChildren {
  className?: string;
}

export const Bar = ({ children, className }: BarProps) => {
  return <div className={cn("p-2 rounded border border-neutral-800", className)}>
    {children}
  </div>;
};
