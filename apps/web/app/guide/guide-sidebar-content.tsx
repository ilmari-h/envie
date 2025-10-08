"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/button";
import { guidePages } from "./guide-pages";
import { cn } from "@sglara/cn";
export function GuideSidebarContent() {
  const pathname = usePathname();

  const isCurrentPath = (href: string) => {
    return pathname === href;
  };

  return (
    <div className="mt-4 space-y-2 overflow-y-auto flex-1 pr-2">
      {guidePages.map((page, index) => (
        <div key={index} className="space-y-1">
          <Link href={`/guide/${page.slug}`} className="block">
            <Button
              variant="ghost"
              className="opacity-100 w-full justify-start font-semibold text-left"
              disabled={isCurrentPath(`/guide/${page.slug}`)}
            >
              {index + 1}.{" "}{page.title}
            </Button>
            {isCurrentPath(`/guide/${page.slug}`) && (
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-400 to-transparent" />
            )}
          </Link>
          {page.children && page.children.length > 0 && (
            <div className="ml-4 space-y-1">
              {page.children.map((child, childIndex) => {
                const childHref = `/guide/${page.slug}/${child.slug}`;
                return (
                  <Link 
                    key={childIndex} 
                    href={childHref} 
                    className="block"
                  >
                    <Button
                      variant={"ghost"}
                      className={
                        cn("opacity-100 w-full justify-start text-sm text-neutral-400 hover:text-neutral-200 text-left",
                          isCurrentPath(childHref) && "text-neutral")
                        }
                        disabled={isCurrentPath(childHref)}
                    >
                      {index + 1}.{childIndex + 1}.{" "}{child.title}
                    </Button>
                      {isCurrentPath(childHref) && (
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-400 to-transparent" />
                      )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
