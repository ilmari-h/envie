"use client";

import { useState } from "react";
import { LogoutButton } from "./logout-button";
import { Menu, ArrowLeft } from "lucide-react";
import { getAuthHint } from "../utils/get-auth-hint";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const user = getAuthHint()


  const toggleSidebar = () => setIsOpen(!isOpen);

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
                    {user.username}
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
