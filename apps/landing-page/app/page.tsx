import Home from './home';

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  published_at: string;
}

async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch('https://api.github.com/repos/ilmari-h/envie/releases/latest', {
      next: { revalidate: 300 } // Revalidate every 5 minutes
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch latest release');
    }
    
    const release: GitHubRelease = await response.json();
    return release;
  } catch (error) {
    console.error('Error fetching latest release:', error);
    return null;
  }
}

export default async function HomePage() {
  const latestRelease = await getLatestRelease();
  
  return <Home latestRelease={latestRelease} />;
}
