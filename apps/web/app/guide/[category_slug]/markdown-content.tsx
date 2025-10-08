"use client";

import Markdown from "@repo/ui/markdown";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type MarkdownPage = {
  markdown: string;
  header: string;
}

export type AdjacentPage = {
  title: string;
  slug: string;
}

export default function MarkdownContent({ 
  markdownPages, 
  nextPage,
  previousPage
}: { 
  markdownPages: MarkdownPage[];
  nextPage?: AdjacentPage;
  previousPage?: AdjacentPage;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToHash = useCallback(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;
    const targetText = decodeURIComponent(hash.slice(1)).trim();
    const container = containerRef.current;
    if (!container) return;
    const headings = container.querySelectorAll("h1, h2, h3, h4");
    for (const heading of Array.from(headings)) {
      const text = (heading.textContent || "").trim();
      if (text === targetText) {
        heading.scrollIntoView({ behavior: "auto" });
        break;
      }
    }
  }, []);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
      scrollToHash();
  }, [scrollToHash, pathname, searchParams, markdownPages]);

  return (
    <div>
      <div ref={containerRef}>
        <Markdown>{
          markdownPages.map(page => `# ${page.header}\n${page.markdown}`).join("\n")
        }</Markdown>
      </div>
      
      {(nextPage || previousPage) && (
        <div className="mt-8 pt-6 border-t border-neutral-700">
          <div className="flex justify-between">
            {previousPage ? (
              <Link href={`/guide/${previousPage.slug}`}>
                <Button iconPosition="left" icon={<ChevronLeft className="w-4 h-4" />} variant="ghost">
                  Previous: {previousPage.title}
                </Button>
              </Link>
            ) : <div className="w-1/2" />}
            {nextPage ? (
              <Link href={`/guide/${nextPage.slug}`}>
                <Button iconPosition="right" icon={<ChevronRight className="w-4 h-4" />} variant="ghost">
                  Next: {nextPage.title}
                </Button>
              </Link>
            ) : <div className="w-1/2" />}
          </div>
        </div>
      )}
    </div>
  );
}