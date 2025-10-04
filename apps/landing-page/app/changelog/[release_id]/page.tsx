import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from '@repo/ui/markdown';

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  created_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  assets: Array<{
    name: string;
    download_count: number;
    browser_download_url: string;
    size: number;
  }>;
}

async function getRelease(releaseId: string): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/ilmari-h/envie/releases/${releaseId}`, {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch release: ${response.status}`);
    }
    
    const release: GitHubRelease = await response.json();
    
    // Don't show draft releases
    if (release.draft) {
      return null;
    }
    
    return release;
  } catch (error) {
    console.error('Error fetching release:', error);
    return null;
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

interface PageProps {
  params: Promise<{ release_id: string }>;
}

export default async function ReleasePage({ params }: PageProps) {
  const { release_id } = await params;
  const release = await getRelease(release_id);

  if (!release) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <div className="mb-8">
        <Link 
          href="/changelog" 
          className="text-accent-400 hover:text-accent-300 transition-colors text-sm"
        >
          ← Back to Changelog
        </Link>
      </div>

      {/* Release Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-3xl md:text-4xl font-bold">
            {release.name || release.tag_name}
          </h1>
          {release.prerelease && (
            <span className="bg-yellow-500/20 text-yellow-400 text-sm px-3 py-1 rounded-full">
              Pre-release
            </span>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-neutral-500">
          <div className="flex items-center gap-2">
            <span>Published</span>
            <time dateTime={release.published_at} className="text-neutral-300">
              {formatDate(release.published_at)}
            </time>
          </div>
          <div className="flex items-center gap-2">
            <span>by</span>
            <a 
              href={release.author.html_url}
              className="text-accent-400 hover:text-accent-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {release.author.login}
            </a>
          </div>
          <a
            href={release.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-400 hover:text-accent-300 transition-colors text-sm"
          >
            View on GitHub →
          </a>
        </div>
      </header>

      {/* Assets Section */}
      {release.assets && release.assets.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Downloads</h2>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <div className="space-y-2">
              {release.assets.map((asset, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-neutral-800/50 rounded">
                  <div className="flex-1">
                    <a
                      href={asset.browser_download_url}
                      className="text-accent-400 hover:text-accent-300 transition-colors font-mono text-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {asset.name}
                    </a>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>{formatFileSize(asset.size)}</span>
                    <span>{asset.download_count} downloads</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Release Notes */}
      {release.body && (
        <section>
          <h2 className="text-xl font-semibold mb-6">Release Notes</h2>
          <Markdown>{release.body}</Markdown>
        </section>
      )}

    </div>
  );
}
