"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { Menu, ArrowLeft, CreditCard, Zap } from "lucide-react";
import { getAuthHint } from "../utils/get-auth-hint";
import { ClientInferResponseBody } from "@ts-rest/core";
import { contract } from "@repo/rest";
import { Button } from "@repo/ui/button";
import Link from "next/link";

type User = ClientInferResponseBody<typeof contract.user.getUser, 200>
export default function Sidebar({user}: {user: User}) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const isPaidUser = (user?.limits?.maxOrganizations ?? 1) > 1;

  const toggleSidebar = () => setIsOpen(!isOpen);

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
    <>
      {/* Mobile menu button - only show when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 md:hidden p-2 bg-neutral-900 border border-neutral-800 rounded hover:bg-neutral-800 transition-colors"
        >
          <Menu className="w-5 h-5 text-neutral-100" />
        </button>
      )}

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full w-64 bg-neutral-950 border-r border-neutral-800 z-40
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="flex flex-col h-full p-4">
          {/* User info */}
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-neutral-400">
                  logged in as
                  <span className="font-mono text-sm text-neutral-100 break-all ml-2">
                    {user.name}
                  </span>
                </p>
                {/* Collapse button - only on mobile */}
                <button
                  onClick={toggleSidebar}
                  className="md:hidden p-1 hover:bg-neutral-800 rounded transition-colors ml-2 mb-1"
                >
                  <ArrowLeft className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
            </div>

            {/* Billing/Upgrade button */}
            <div className="mb-4 w-full">
              {isPaidUser ? (
                <button 
                  onClick={handleManageBilling}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-4 py-2 rounded text-xs transition-colors font-mono flex items-center justify-center gap-2"
                >
                  Manage Billing
                </button>
              ) : (
                  <Link href="/onboarding/account-setup">
                  <Button 
                    variant="accent"
                    className="w-full mb-3"
                  >
                    Upgrade Plan
                  </Button>
                  </Link>
              )}
            </div>
            {/* Support contact */}
            <div >
              <p className="font-mono text-xs text-neutral-400 mb-1">Contact support</p>
              <a
                href="mailto:support@envie.cloud"
                className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                support@envie.cloud
              </a>
            </div>

            {/* Logout button */}
            <div className="mt-auto w-full">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
