"use client";

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Github,
  ArrowRight,
  Star,
  Terminal
} from 'lucide-react';

export default function HomePage() {
  const [copied, setCopied] = useState(false);

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
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Header */}
      <header className="relative z-50 px-6 py-3">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-gradient-to-br from-green-400 to-green-500 rounded-md flex items-center justify-center">
              <Terminal className="w-4 h-4 text-black" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
              Envie
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="https://github.com/ilmari-h/envie" className="text-gray-300 hover:text-green-400 transition-colors flex items-center space-x-1 text-sm">
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <a href="https://web.envie.cloud/new-user" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 px-4 py-1.5 rounded-md font-medium text-sm transition-all duration-200 transform hover:scale-105">
              Sign Up
            </a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 py-16 md:py-24 overflow-hidden"
               style={{
                 backgroundImage: `
                   linear-gradient(to right, rgba(156, 163, 175, 0.12) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(156, 163, 175, 0.12) 1px, transparent 1px)
                 `,
                 backgroundSize: '32px 32px'
               }}>
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-500/3 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 mb-6">
            <Star className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-300">Open Source & Self-Hostable</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Stop DMing your
            <span className="block bg-gradient-to-r from-green-400 via-green-500 to-green-600 bg-clip-text text-transparent">
              .env files.
            </span>

          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed space-y-2">
            <span className="text-green-400">Speed up development:</span> One command away from prod, staging, or dev.
            <br/>
            Keep your team's environments <span className="text-green-400">secure</span> and <span className="text-green-400">organized</span>.
          </p>

          {/* Install Command */}
          <div className="max-w-xl mx-auto mb-10">
            <p className="text-sm text-gray-400 mb-2">Install with npm:</p>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-green-600 rounded-lg blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-black border border-green-500/30 rounded-lg p-3 flex items-center justify-between">
                <code className="text-green-400 font-mono text-base flex-1 text-left text-center">
                  npm install -g @envie/cli
                </code>
                <button
                  onClick={copyInstallCommand}
                  className="ml-3 p-1.5 hover:bg-green-500/20 rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 hover:text-green-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href="https://web.envie.cloud/new-user" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 px-6 py-2.5 rounded-md font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-green-500/25 flex items-center space-x-2">
              <span>Start Building</span>
            </a>
            <div className="w-px ml-2 h-8 bg-white/40 hidden sm:block"></div>
            <a 
              href="https://github.com/ilmari-h/envie" 
              className="border-none px-0 py-2.5 rounded-md font-medium transition-all duration-200 flex items-center space-x-2"
            >
              <Github className="w-4 h-4" />
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* Code Demo Section */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Switch between environments with one command<br/>
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-xl text-transparent">Manage and organize your API keys, credentials and secrets.</span>
            </h2>
          </div>
          
          <div className="bg-gray-900/40 border border-green-500/30 rounded-lg p-4 font-mono text-sm">
            <div className="flex items-center mb-3">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-gray-400 text-xs mt-3"># Debug your staging environment</div>
              <div className="text-white">$ envie exec org:project:staging npm -- start</div>
              <div className="text-gray-400 text-xs mt-3"><br/># Update a variable</div>
              <div className="text-white">$ envie set org:project:staging \<br/>DATABASE_URL=postgresql://user:password@localhost:5432/my_database</div>
              <div className="text-gray-400 text-xs mt-3"><br/># Find out who changed what and when</div>
              <div className="text-gray-400 text-xs mt-3"># Audit trail of environment changes that you can roll back</div>
              <div className="text-white">$ envie audit org:project:staging</div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source CTA */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-green-900/5 border border-green-500/20 rounded-xl p-8">
            <Github className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                100% Open Source
              </span>
            </h2>
            <p className="text-lg text-gray-300 mb-6 max-w-xl mx-auto">
              Envie is completely open source and free to use. Self-host on your own infrastructure 
              or use our hosted solution.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a 
                href="https://github.com/ilmari-h/envie"
                className="bg-gray-800 hover:bg-gray-700 border border-green-500/40 hover:border-green-400 px-6 py-2.5 rounded-md font-medium transition-all duration-200 flex items-center space-x-2 justify-center"
              >
                <Star className="w-4 h-4" />
                <span>Star on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-3 md:mb-0">
              <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-md flex items-center justify-center">
                <Terminal className="w-4 h-4 text-black" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                Envie
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <a href="https://github.com/ilmari-h/envie" className="text-gray-400 hover:text-green-400 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <span className="text-gray-500">•</span>
              <a href="mailto:support@envie.cloud" className="text-gray-400 hover:text-green-400 transition-colors text-sm">
                support@envie.cloud
              </a>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400 text-sm">
                Made with ❤️ for developers
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
