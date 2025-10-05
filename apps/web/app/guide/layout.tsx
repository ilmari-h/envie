"use server"

import { marked } from "marked";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Sidebar } from "@repo/ui/sidebar";

type GuidePage = {
  url: string;
  title: string;
  slug: string;
}

const guidePages: GuidePage[] = [
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/getting-started.md",
   title: "Getting started",
   slug: "getting-started",
 },
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/projects.md",
   title: "Projects",
   slug: "projects",
 },
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/environments.md",
   title: "Environments",
   slug: "environments",
 },
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/deploy-prod.md",
   title: "Deploy with Envie",
   slug: "deploy-prod",
 },
]

async function fetchMarkdownContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return "";
  }
}

function extractHeaders(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const h3Headers: string[] = [];
  
  for (const token of tokens) {
    if (token.type === 'heading' ) {
      // Extract text content from the heading
      const text = token.text || '';
      h3Headers.push(text);
    }
  }
  
  return h3Headers;
}

export default async function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const markdownPages = await Promise.all(
    guidePages.map(async (page) => {
      const markdown = await fetchMarkdownContent(page.url);
      return markdown ? {
        markdown,
        header: {
          title: page.title,
          subheaders: extractHeaders(markdown)
        },
        slug: page.slug
      } : null;
    })
  );

  const headers = markdownPages.filter(page => page !== null).map(page => page.header);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1">
        <Sidebar>
          {/* Guide navigation */}
          <div className="mt-4 space-y-2 overflow-y-auto flex-1 pr-2">
            {headers.map((header, index) => (
              <div key={index} className="space-y-1">
                <Link href={`/guide/${guidePages[index]?.slug}`} className="block">
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-semibold text-left"
                  >
                    {index + 1}.{" "}{header.title}
                  </Button>
                </Link>
                {header.subheaders.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {header.subheaders.map((subheader, subIndex) => (
                      <Link 
                        key={subIndex} 
                        href={`/guide/${guidePages[index]?.slug}#${encodeURIComponent(subheader)}`} 
                        className="block"
                      >
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-sm text-neutral-400 hover:text-neutral-200 text-left"
                        >
                          {index + 1}.{subIndex + 1}.{" "}{subheader}
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
