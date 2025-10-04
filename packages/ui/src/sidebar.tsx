"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, ArrowLeft } from "lucide-react";

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);

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
          {/* Header */}
          <div className="flex items-center justify-center mr-4">
            <Image
              src="/icon-small.png"
              alt="Envie"
              width={24}
              height={24}
            />

            <span className="text-base font-bold text-logo bg-clip-text ml-[-1px] italic">
              nvie
            </span>

            {/* Collapse button - only on mobile */}
            <button
              onClick={toggleSidebar}
              className="md:hidden p-1 hover:bg-neutral-800 rounded transition-colors ml-auto absolute right-4"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          <div className="h-[1px] mt-3 bg-gradient-to-r from-transparent via-accent-600/50 to-transparent"></div>

          {/* Children content */}
          {children}
        </div>
      </div>
    </>
  );
}
