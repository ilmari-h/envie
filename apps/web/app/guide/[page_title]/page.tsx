import MarkdownContent from './markdown-content';
import { guidePages } from '../guide-pages';
import { notFound } from 'next/navigation';
import { NextPage } from './markdown-content';

interface PageProps {
  params: {
    page_title: string;
  };
}

async function fetchGuideContent(pageTitle: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/${pageTitle}.md`;
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
    return `# Guide Not Found\n\nSorry, the guide "${pageTitle}" could not be loaded.`;
  }
}

function getNextPage(currentPageTitle: string): NextPage | undefined {
  const currentIndex = guidePages.findIndex(page => 
    page.url === `https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/${currentPageTitle}.md`
  );
  
  if (currentIndex === -1 || currentIndex === guidePages.length - 1) {
    return undefined;
  }
  
  const nextPage = guidePages[currentIndex + 1];
  if (!nextPage) {
    return undefined;
  }
  return {
    title: nextPage.title,
    slug: nextPage.slug
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { page_title } = params;
  const markdownContent = await fetchGuideContent(page_title);
  const nextPage = getNextPage(page_title);
  
  const markdownPages = [{
    markdown: markdownContent,
    header: page_title.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }];

  return <MarkdownContent markdownPages={markdownPages} nextPage={nextPage} />;
}
