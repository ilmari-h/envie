import MarkdownContent from './markdown-content';
import { guidePages, baseUrl } from '../guide-pages';
import { notFound, redirect } from 'next/navigation';

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

function computeAdjacentPages(categoryIndex: number): { nextPage?: AdjacentPage; previousPage?: AdjacentPage } {
  const nextCategory = categoryIndex < guidePages.length - 1 ? guidePages[categoryIndex + 1] : undefined;
  const previousCategory = categoryIndex > 0 ? guidePages[categoryIndex - 1] : undefined;

  const nextPage = nextCategory
    ? (nextCategory.children && nextCategory.children.length > 0 && nextCategory.children[0]
        ? { title: nextCategory.children[0].title, slug: `${nextCategory.slug}/${nextCategory.children[0].slug}` }
        : { title: nextCategory.title, slug: nextCategory.slug }
      )
    : undefined;

  const previousPage = previousCategory
    ? (previousCategory.children && previousCategory.children.length > 0
        ? (() => {
            const lastChild = previousCategory.children[previousCategory.children.length - 1];
            if (!lastChild) {
              return { title: previousCategory.title, slug: previousCategory.slug } as AdjacentPage;
            }
            return { title: lastChild.title, slug: `${previousCategory.slug}/${lastChild.slug}` } as AdjacentPage;
          })()
        : { title: previousCategory.title, slug: previousCategory.slug }
      )
    : undefined;

  return { nextPage, previousPage };
}

export default async function GuidePage({ params }: { params: Promise<{ category_slug: string }> }) {
  const { category_slug } = await params;
  console.log('category_slug', category_slug);
  
  // Find the category by slug
  const categoryIndex = guidePages.findIndex(page => page.slug === category_slug);
  const category = guidePages[categoryIndex];
  if (!category) {
    return notFound();
  }

  // If category has children, redirect to first child
  if (category.children && category.children.length > 0 && category.children[0]) {
    return redirect(`/guide/${category_slug}/${category.children[0].slug}`);
  }

  // If category has no children, render content directly
  const contentUrl = `${baseUrl}/${category_slug}.md`;
  const markdownContent = await fetchGuideContent(contentUrl);
  
  const markdownPages = [{
    markdown: markdownContent,
    header: category.title
  }];

  const { nextPage, previousPage } = computeAdjacentPages(categoryIndex);

  return <MarkdownContent markdownPages={markdownPages} nextPage={nextPage} previousPage={previousPage} />;
}
