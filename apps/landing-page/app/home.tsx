"use client";

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Star,
  FolderTree,
  History,
  Users,
  Code2
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@repo/ui/button';
import Link from 'next/link';
import AnimatedTerminal, { Line } from './animated-terminal';

type TabType = 'secure' | 'organize' | 'audit' | 'collaborate';

const TERMINAL_CONTENTS: Record<TabType, Line[]> = {
  secure: [
  { content: "Migrate your .env file to an envie Environment", isComment: true },
  { content: "envie environment create org:project:staging --file .env", typing: true },
  { content: " ", delay: 100 },
  { content: "Update a variable", isComment: true },
  { content: "envie set org:project:staging API_KEY=1234567890", typing: true },
  { content: " ", delay: 100 },
  { content: "Show your environment", isComment: true },
  { content: "envie environment show org:project:staging", typing: true },
  { content: `
╭─── org:project:staging (4 variables)
│ API_KEY=<encrypted>
│ DATABASE_URL=<encrypted>
│ OAUTH_SECRET=<encrypted>
│ APP_ID=<encrypted>
╰──────────────────────────────────────────`,  },
  { content: "Run your project with your environment variables", isComment: true },
  { content: "envie exec org:project:staging npm -- dev", typing: true },
  { content: `
$ next dev --port 3000
    ▲ Next.js 15.0.0
    - Local:        http://localhost:3000
    - Network:      http://0.0.0.0:3000
`,  },
  ],
  organize: [
    { content: "Group related variables together in a group", isComment: true },
    { content: "envie variable-group create org oauth OAUTH_SECRET=123 CLIENT_ID=456", typing: true },
    { content: " ", delay: 100 },
    { content: "Add the group to an environment", isComment: true },
    { content: "envie environment add-group org:project:staging org:group:oauth", typing: true },
    { content: " ", delay: 100 },
    { content: "See your neatly organized environment", isComment: true },
    { content: "envie environment show org:project:staging", typing: true },
    { content: `
╭─── org:project:staging (2 variables)
│ API_KEY=<encrypted>
│ DATABASE_URL=<encrypted>
│ 
╭─── org:project:aws (3 variables)
│ AWS_ACCESS_KEY_ID=<encrypted>
│ AWS_SECRET_ACCESS_KEY=<encrypted>
│ S3_BUCKET_NAME=<encrypted>
│
╭─── org:group:oauth (2 variables)
│ OAUTH_SECRET=<encrypted>
│ APP_ID=<encrypted>
╰──────────────────────────────────────────`,  },
    { content: "", blink: true, },
  ],
  audit: [
    { content: "See who modified your environment and when", isComment: true },
    { content: "envie environment audit org:project:staging", typing: true },
    { content: `
v10 Sep 9, 2025, 09:20 AM by john (latest)
v9 Sep 9, 2025, 09:15 AM by amy
v8 Sep 8, 2025, 09:12 AM by john
v7 Sep 4, 2025, 09:11 AM by john
v6 Sep 3, 2025, 09:10 AM by robert
v5 Sep 1, 2025, 09:10 AM by robert
v4 Sep 1, 2025, 09:04 AM by john
v3 Aug 26, 2025, 09:04 AM by amy
v2 Aug 24, 2025, 09:03 AM by amy
v1 Aug 10, 2025, 08:42 AM by john
────────────────────────────────────────────────────────────
Total versions: 10
`,  },
    { content: " ", delay: 100 },
    { content: "Rollback to a previous version", isComment: true },
    { content: "envie environment rollback org:project:staging 6", typing: true },
    { content: "", blink: true, },
  ],
  collaborate: [
    { content: "Create an invite link for your team", isComment: true },
    { content: "envie organization invite my-organization --expiry 1d", typing: true },
    {content: `
Invite created! Anyone with this link can join the organization:
https://web.envie.cloud/invite?inviteId=32d294ulux2gi4ef2p4g3s
` },
    { content: " ", delay: 100 },
    { content: "Grant access to your environment", isComment: true },
    { content: "envie environment set-access my-organization:web-app:staging john --write", typing: true },
    { content: " ", delay: 100 },
    { content: "See who can access your environment", isComment: true },
    { content: "envie environment list-access my-organization:web-app:staging", typing: true },
    { content: `
NAME      TYPE  ID               WRITE ACCESS
--------  ----  ---------------  ------------
robert    user  github:12345678  ✓
amy       user  github:abcdefgh  ✗
john      user  github:87654321  ✓
`,  },
    { content: "", blink: true, },
  ],
};

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  published_at: string;
}

interface HomeProps {
  latestRelease?: GitHubRelease | null;
}

export default function Home({ latestRelease }: HomeProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('secure');

  const copyInstallCommand = async () => {
    try {
      await navigator.clipboard.writeText('npm install -g @envie/cli');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative px-4 py-[60px] md:py-[100px] overflow-hidden"
               style={{
                 backgroundImage: `
                   linear-gradient(to right, rgba(156, 163, 175, 0.08) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(156, 163, 175, 0.08) 1px, transparent 1px)
                 `,
                 backgroundSize: '24px 24px'
               }}>
        <div className="absolute inset-0 bg-gradient-to-r from-accent-500/3 to-transparent"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-accent-500/2 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-accent-500/10 px-2 py-1 rounded-full border border-accent-500/20 mb-4">
            <Star className="w-3 h-3 text-accent-400" />
            <span className="text-xs text-accent-300">Open Source & Self-Hostable</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold mb-3 leading-tight">
            Stop DMing your{ ' ' }
            <span className="block md:inline bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-transparent">
              .env files.
            </span>

          </h1>
          
          <p className="text-lg md:text-xl text-neutral-400 mb-[70px] mx-auto leading-relaxed">
            <span className="text-accent-400">Speed up development:</span> One command away from prod, staging, or dev.
            <br/>
            Keep your team's environments <span className="text-accent-400">secure</span> and <span className="text-accent-400">organized</span>.
          </p>

          {/* Install Command */}
          <div className="max-w-lg mx-auto mb-6">
            <p className="text-xs text-neutral-500 mb-2">Install with npm:</p>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-500 to-accent-600 rounded-lg blur opacity-15 group-hover:opacity-25 transition-opacity"></div>
              <button
                onClick={copyInstallCommand}
                className="relative w-full bg-neutral-900 border border-accent-500/30 rounded-lg p-2 flex items-center justify-between hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <code className="text-accent-300 font-mono text-sm flex-1 text-center">
                  npm install -g @envie/cli
                </code>
                <div className="ml-2 p-1">
                  {copied ? (
                    <Check className="w-3 h-3 text-accent-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-neutral-500" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
            <Link href="https://web.envie.cloud/onboarding">
              <Button variant="accent" className='min-w-[130px]'>Start Building</Button>
            </Link>
            <div className="w-px h-6 bg-neutral-600 hidden sm:block mx-2"></div>
            {latestRelease ? (
              <Link href={`/changelog/${latestRelease.id}`}>
                <Button variant="ghost" className='min-w-[130px]'>
                  <span className="font-bold text-accent-400">NEW:</span>{' '}
                  v{latestRelease.tag_name} released
                </Button>
              </Link>
            ) : (
              <Link href="https://github.com/ilmari-h/envie">
                <Button variant="ghost" icon={<Image src="/github.svg" alt="GitHub" width={16} height={16} className="brightness-0 invert" />} className='min-w-[130px]'>
                  View on GitHub
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Code Demo Section */}
      <section className="px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-lg md:text-xl font-bold mb-2">
              A unified CLI to manage your application secrets and environment variables<br/>
              <span className="bg-gradient-to-r from-accent-400 to-accent-600 bg-clip-text text-lg md:text-xl text-transparent">Convenient, auditable and always encrypted.</span>
            </h2>
          </div>
          
          {/* Tab Row */}
          <div className="mb-2">
             <div className="border-t border-neutral-700/50 p-3 pt-5 inline-flex w-full justify-center space-x-2">
               <Button 
                 variant={activeTab === 'secure' ? 'accent' : 'regular'} 
                 icon={<Code2 className="w-3 h-3" />}
                 onClick={() => setActiveTab('secure')}
               >
                 Execute
               </Button>
               <Button 
                 variant={activeTab === 'organize' ? 'accent' : 'regular'} 
                 icon={<FolderTree className="w-3 h-3" />}
                 onClick={() => setActiveTab('organize')}
               >
                 Organize
               </Button>
               <Button 
                 variant={activeTab === 'audit' ? 'accent' : 'regular'} 
                 icon={<History className="w-3 h-3" />}
                 onClick={() => setActiveTab('audit')}
               >
                 Audit
               </Button>
               <Button 
                 variant={activeTab === 'collaborate' ? 'accent' : 'regular'} 
                 icon={<Users className="w-3 h-3" />}
                 onClick={() => setActiveTab('collaborate')}
               >
                 Collaborate
               </Button>
             </div>
          </div>
          
          <AnimatedTerminal 
            lines={TERMINAL_CONTENTS[activeTab]} 
            delayBetweenLines={800}
            typingSpeed={30}
            key={activeTab}
          />
        </div>
      </section>

      {/* Open Source CTA */}
      <section className="px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-accent-900/5 border border-accent-500/20 rounded-lg p-6">
            <Image src="/github.svg" alt="GitHub" width={32} height={32} className="brightness-0 invert mx-auto mb-3" />
            <h2 className="text-lg md:text-xl font-bold mb-2">
              <span className="bg-gradient-to-r from-accent-400 to-accent-600 bg-clip-text text-transparent">
                100% Open Source
              </span>
            </h2>
            <p className="text-sm text-neutral-400 mb-4 max-w-lg mx-auto">
              Envie is completely open source and free to use. Self-host on your own infrastructure 
              or use our hosted solution.
            </p>
            <div className="flex justify-center">
              <Link href="https://github.com/ilmari-h/envie">
                <Button variant="regular" icon={<Star className="w-3 h-3" />}>
                  Star on GitHub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
