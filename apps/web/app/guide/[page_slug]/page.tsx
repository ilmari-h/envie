import MarkdownContent from './markdown-content';
import { guidePages } from '../guide-pages';
import { notFound } from 'next/navigation';

async function fetchGuideContent(url: string): Promise<string> {
  const guidePage = guidePages.find(page => page.url === url);
  if (!guidePage) {
    return notFound();
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch guide: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching guide content:', error);
    return `# Guide Not Found\n\nSorry, the guide "${url}" could not be loaded.`;
  }
}


export default async function GuidePage({ params }: { params: Promise<{ page_slug: string }> }) {
  const { page_slug } = await params;
  const pageIndex = guidePages.findIndex(page => page.slug === page_slug);
  if (pageIndex === -1) {
    return notFound();
  }

  const page = guidePages[pageIndex]!;
  const markdownContent = await fetchGuideContent(page.url);
  const previousPage = pageIndex > 0 ? guidePages[pageIndex - 1] : undefined;
  const nextPage = pageIndex < guidePages.length - 1 ? guidePages[pageIndex + 1] : undefined;
  
  const markdownPages = [{
    markdown: markdownContent,
    header: page.title
  }];

  return <MarkdownContent markdownPages={markdownPages} nextPage={nextPage} previousPage={previousPage} />;
}
