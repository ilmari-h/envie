"use client";

import { useRouter, usePathname } from "next/navigation";
import { CreditCard, Zap, User, Settings, LogOut, BookOpen, Home } from "lucide-react";
import { ClientInferResponseBody } from "@ts-rest/core";
import { contract } from "@repo/rest";
import { Button } from "@repo/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui/popover";
import { Sidebar } from "@repo/ui/sidebar";
import Link from "next/link";
import { env } from "next-runtime-env";

type User = ClientInferResponseBody<typeof contract.user.getUser, 200>
export default function WebSidebar({user}: {user: User}) {
  const router = useRouter();
  const isPaidUser = (user?.limits?.maxOrganizations ?? 1) > 1;
  const currentPath = usePathname();

  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to create portal session:', data.error);
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
    }
  };

  const handleUpgrade = () => {
    router.push('/onboarding');
  };

  if (!user) {
    return null;
  }

  return (
    <Sidebar>
      {/* Action buttons */}
      <div className="mt-4 space-y-2">
        <Link href="/dashboard" className="block">
          <Button
            variant={currentPath === '/dashboard' ? 'regular' : 'ghost'}
            className="w-full justify-start border-none"
          >
          <Home className="w-4 h-4" />
            Home
          </Button>
        </Link>

        <Link href="/guide" className="block">
          <Button
            variant="ghost"
            className="w-full justify-start"
          >
            <BookOpen className="w-4 h-4" />
            User Guide
          </Button>
        </Link>
        
        {!isPaidUser && (
          <Button
            onClick={handleUpgrade}
            variant="ghost"
            className="w-full justify-start gap-2 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800"
          >
            <Zap className="w-4 h-4" />
            Upgrade Plan
          </Button>
        )}
      </div>

      {/* Main content area - flex-1 to push user info to bottom */}
      <div className="flex-1">
        {/* Add your main content here if needed */}
      </div>

      {/* User info and support at bottom */}
      <div className="space-y-4">
        {/* Support contact */}
        <div>
          <p className="text-xs text-neutral-400 mb-1">Contact support</p>
          <a
            href="mailto:support@envie.cloud"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            support@envie.cloud
          </a>
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 w-full justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-neutral-400" />
            <span className="text-sm text-neutral-100 break-all">
              {user.name}
            </span>
          </div>
          <Popover placement="bottom-end">
            <PopoverTrigger>
              <button className="p-2 hover:bg-neutral-800 rounded transition-colors">
                <Settings className="w-4 h-4 text-neutral-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-neutral-900 border-neutral-800 rounded">
              <div className="py-1">
                {isPaidUser ? (
                  <Button
                    onClick={handleManageBilling}
                    variant="ghost"
                  >
                    <CreditCard className="w-4 h-4" />
                    Manage Billing
                  </Button>
                ) : (
                  <Button
                    onClick={handleUpgrade}
                    variant="ghost"
                  >
                    <Zap className="w-4 h-4" />
                    Upgrade Plan
                  </Button>
                )}
                <div className="border-t border-neutral-800 my-1"></div>
                <div className="px-4 py-2">
                  <Button variant="ghost" onClick={() => {
                    window.location.href = `${env("NEXT_PUBLIC_API_URL")}/auth/logout`;
                  }}>
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Sidebar>
  );
}
