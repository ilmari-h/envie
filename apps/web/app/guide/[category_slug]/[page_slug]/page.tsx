import MarkdownContent from '../markdown-content';
import { guidePages, baseUrl } from '../../guide-pages';
import { notFound } from 'next/navigation';

async function fetchGuideContent(url: string): Promise<string> {
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

type AdjacentPage = { title: string; slug: string };

function computeAdjacentPagesForChild(categoryIndex: number, childIndex: number): { nextPage?: AdjacentPage; previousPage?: AdjacentPage } {
  const category = guidePages[categoryIndex];
  if (!category) return {};
  const children = category.children || [];

  // Next within same category
  if (childIndex < children.length - 1) {
    const nextChild = children[childIndex + 1];
    if (nextChild) {
      return { 
        nextPage: { title: nextChild.title, slug: `${category.slug}/${nextChild.slug}` },
        previousPage: childIndex > 0
          ? { title: children[childIndex - 1]!.title, slug: `${category.slug}/${children[childIndex - 1]!.slug}` }
          : undefined
      };
    }
  }

  // Previous within same category if not handled above
  const prev = childIndex > 0 ? children[childIndex - 1] : undefined;

  // Cross-category next
  const nextCategory = categoryIndex < guidePages.length - 1 ? guidePages[categoryIndex + 1] : undefined;
  const crossNext: AdjacentPage | undefined = nextCategory
    ? (nextCategory.children && nextCategory.children.length > 0
        ? { title: nextCategory.children[0]!.title, slug: `${nextCategory.slug}/${nextCategory.children[0]!.slug}` }
        : { title: nextCategory.title, slug: nextCategory.slug })
    : undefined;

  // Cross-category previous
  const previousCategory = categoryIndex > 0 ? guidePages[categoryIndex - 1] : undefined;
  let crossPrev: AdjacentPage | undefined;
  if (previousCategory) {
    if (previousCategory.children && previousCategory.children.length > 0) {
      const lastChild = previousCategory.children[previousCategory.children.length - 1];
      crossPrev = lastChild
        ? { title: lastChild.title, slug: `${previousCategory.slug}/${lastChild.slug}` }
        : { title: previousCategory.title, slug: previousCategory.slug };
    } else {
      crossPrev = { title: previousCategory.title, slug: previousCategory.slug };
    }
  }

  return {
    nextPage: childIndex < children.length - 1 ? undefined : crossNext,
    previousPage: prev
      ? { title: prev.title, slug: `${category.slug}/${prev.slug}` }
      : crossPrev,
  };
}

export default async function GuideChildPage({ params }: { params: Promise<{ category_slug: string; page_slug: string }> }) {
  const { category_slug, page_slug } = await params;

  const categoryIndex = guidePages.findIndex(page => page.slug === category_slug);
  const category = guidePages[categoryIndex];
  if (!category || !category.children || category.children.length === 0) {
    return notFound();
  }

  const childIndex = category.children.findIndex(child => child.slug === page_slug);
  const child = category.children[childIndex];
  if (!child) {
    return notFound();
  }

  const contentUrl = `${baseUrl}/${category_slug}/${page_slug}.md`;
  const markdownContent = await fetchGuideContent(contentUrl);

  const markdownPages = [{
    markdown: markdownContent,
    header: child.title
  }];

  const { nextPage, previousPage } = computeAdjacentPagesForChild(categoryIndex, childIndex);

  return <MarkdownContent markdownPages={markdownPages} nextPage={nextPage} previousPage={previousPage} />;
}


