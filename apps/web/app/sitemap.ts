import type { MetadataRoute } from 'next'
import { guidePages } from './guide/guide-pages';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  
  // Base URLs
  const baseUrl = 'https://web.envie.cloud';
  
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...guidePages.flatMap((page) => {
      const pages = [{
        url: `${baseUrl}/guide/${page.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1.0,
      }];
      
      if (page.children) {
        pages.push(...page.children.map((child) => ({
          url: `${baseUrl}/guide/${page.slug}/${child.slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.9,
        })));
      }
      
      return pages;
    }),
    {
      url: `${baseUrl}/onboarding`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];
  

  return [...staticRoutes];
}

