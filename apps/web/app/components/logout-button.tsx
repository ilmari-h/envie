
"use client";
import { Button } from "@repo/ui/button";
import { LogOut } from "lucide-react";
import { env } from "next-runtime-env";
import { cn } from "@sglara/cn";

export const LogoutButton = ({className}: {className?: string}) => {
  return (
    <Button
      icon={<LogOut className="w-4 h-4" />}
      onClick={() => {
        window.location.href = `${env("NEXT_PUBLIC_API_URL")}/auth/logout`;  
      }}
      className={cn(className, "w-full")}
    >
      Logout
    </Button>
  );
};
