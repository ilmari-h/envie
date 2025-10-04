import Markdown from "@repo/ui/markdown";
import Link from "next/link";
import { Button } from "@repo/ui/button";

export type MarkdownPage = {
  markdown: string;
  header: string;
}

export type NextPage = {
  title: string;
  slug: string;
}

export default function MarkdownContent({ 
  markdownPages, 
  nextPage 
}: { 
  markdownPages: MarkdownPage[];
  nextPage?: NextPage;
}) {
  return (
    <div>
      <Markdown>{
        markdownPages.map(page => `# ${page.header}\n${page.markdown}`).join("\n")
      }</Markdown>
      
      {nextPage && (
        <div className="mt-8 pt-6 border-t border-neutral-700">
          <div className="flex justify-end">
            <Link href={`/guide/${nextPage.slug}`}>
              <Button>
                Next: {nextPage.title} →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}