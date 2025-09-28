import Markdown from '../components/markdown';

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
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
    console.error('Error fetching releases:', error);
    return [];
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default async function ChangelogPage() {
  const releases = await getReleases();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Changelog
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            See what's new in Envie.
          </p>
        </div>

        {releases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500">No releases available at the moment.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {releases.map((release) => (
              <a
                key={release.id}
                href={`/changelog/${release.id}`}
                className="block bg-neutral-900 border border-neutral-800 rounded-lg p-6 hover:border-accent-500/50 transition-colors cursor-pointer group"
              >
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-accent-400 group-hover:text-accent-300 transition-colors">
                      {release.name || release.tag_name}
                    </h2>
                    {release.prerelease && (
                      <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">
                        Pre-release
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    <time dateTime={release.published_at}>
                      {formatDate(release.published_at)}
                    </time>
                    <div className="flex items-center gap-1">
                      <span>by</span>
                      <span className="text-accent-400">
                        {release.author.login}
                      </span>
                    </div>
                  </div>
                </div>

                {release.body && (
                  <div className="relative">
                    <div className="max-h-44 overflow-hidden">
                      <Markdown className="prose-sm">{release.body}</Markdown>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-neutral-900 via-neutral-900/90 to-transparent flex items-end justify-center pb-2">
                      <span className="text-accent-400 text-sm group-hover:text-accent-300 transition-colors">
                        Read more →
                      </span>
                    </div>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
    </div>
  );
}
