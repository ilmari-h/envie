"use server"

import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Sidebar } from "@repo/ui/sidebar";
import { guidePages } from "./guide-pages";

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1">
        <Sidebar>
          {/* Guide navigation */}
          <div className="mt-4 space-y-2 overflow-y-auto flex-1 pr-2">
            {guidePages.map((page, index) => (
              <div key={index} className="space-y-1">
                <Link href={`/guide/${page.slug}`} className="block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-semibold text-left"
                  >
                    {index + 1}.{" "}{page.title}
                  </Button>
                </Link>
                {page.children && page.children.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {page.children.map((child, childIndex) => (
                      <Link 
                        key={childIndex} 
                        href={`/guide/${page.slug}/${child.slug}`} 
                        className="block"
                      >
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-sm text-neutral-400 hover:text-neutral-200 text-left"
                        >
                          {index + 1}.{childIndex + 1}.{" "}{child.title}
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Sidebar>

        {/* Main content area - positioned next to sidebar */}
        <main className="flex flex-col justify-start gap-8 px-8 py-8 md:ml-64 max-w-[1000px] mt-10 flex-1">
          {children}
        </main>
      </div>

      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium md:ml-64">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
