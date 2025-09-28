import type { MetadataRoute } from 'next'

interface GitHubRelease {
  id: number;
  tag_name: string;
  published_at: string;
  draft: boolean;
}

async function getReleases(): Promise<GitHubRelease[]> {
  try {
    const response = await fetch('https://api.github.com/repos/ilmari-h/envie/releases', {
      next: { revalidate: 300 } // Revalidate every 5 minutes
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch releases');
    }
    
    const releases: GitHubRelease[] = await response.json();
    return releases.filter(release => !release.draft);
  } catch (error) {
    console.error('Error fetching releases for sitemap:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const releases = await getReleases();
  
  // Base URLs
  const baseUrl = 'https://envie.cloud';
  
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];
  
  // Dynamic release routes
  const releaseRoutes: MetadataRoute.Sitemap = releases.map((release) => ({
    url: `${baseUrl}/changelog/${release.id}`,
    lastModified: new Date(release.published_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  
  return [...staticRoutes, ...releaseRoutes];
}
