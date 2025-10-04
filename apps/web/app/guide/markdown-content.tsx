import Markdown from "@repo/ui/markdown";

export type MarkdownPage = {
  markdown: string;
  header: string;
}

export default function MarkdownContent({ markdownPages }: { markdownPages: MarkdownPage[] } ) {
  return <Markdown>{
    markdownPages.map(page => `# ${page.header}\n${page.markdown}`).join("\n")
    }</Markdown>;
}