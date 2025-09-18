
"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { tsr } from '../tsr';
import Sidebar from '../components/sidebar';
import { type AuthenticatedUser } from '../auth/helpers';
import { contract } from '@repo/rest';
import { ClientInferResponseBody } from '@ts-rest/core';

type User = ClientInferResponseBody<typeof contract.user.getUser, 200>
export default function Dashboard({user}: {user: User}) {
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({...prev, [key]: true}));
      setTimeout(() => {
        setCopiedStates(prev => ({...prev, [key]: false}));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen h-full">
      <Sidebar user={user} />
      <main className="flex flex-col items-center justify-start gap-8 h-full px-8 py-8 md:ml-64 max-w-[1000px] mt-10">
        <div className="max-w-4xl">
          <h1 className="font-mono text-neutral-100 text-2xl mb-2">Getting Started with Envie</h1>
          <p className="text-neutral-400 text-sm mb-8">Manage your enviornment variables, secrets and API keys.</p>
          
          {/* Step 1: Installation */}
          <div className="mb-8">
            <h2 className="font-mono text-neutral-200 text-lg mb-4">1. Install the CLI</h2>
            <p className="text-neutral-400 text-sm mb-3">To get started, install envie via npm:</p>
            <div className="flex items-center justify-between bg-black border border-neutral-700 rounded px-4 py-3 font-mono text-sm max-w-lg">
              <span className="text-neutral-100">npm install -g @envie/cli</span>
              <button
                onClick={() => copyToClipboard('npm install -g @envie/cli', 'install')}
                className="ml-3 p-1 hover:bg-neutral-800 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copiedStates.install ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Setup */}
          <div className="mb-8">
            <h2 className="font-mono text-neutral-200 text-lg mb-4">2. Run Setup Wizard</h2>
            <p className="text-neutral-400 text-sm mb-3">Run the command envie without arguments to bring up a setup wizard:</p>
            <div className="flex items-center justify-between bg-black border border-neutral-700 rounded px-4 py-3 font-mono text-sm max-w-lg">
              <span className="text-neutral-100">envie</span>
              <button
                onClick={() => copyToClipboard('envie', 'setup')}
                className="ml-3 p-1 hover:bg-neutral-800 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copiedStates.setup ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          {/* Step 3: Login */}
          <div className="mb-8">
            <h2 className="font-mono text-neutral-200 text-lg mb-4">3. Authenticate</h2>
            <p className="text-neutral-400 text-sm mb-3">If you already have envie configured, authenticate with:</p>
            <div className="flex items-center justify-between bg-black border border-neutral-700 rounded px-4 py-3 font-mono text-sm max-w-lg">
              <span className="text-neutral-100">envie login</span>
              <button
                onClick={() => copyToClipboard('envie login', 'login')}
                className="ml-3 p-1 hover:bg-neutral-800 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copiedStates.login ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          {/* Additional Resources */}
          <div className="mb-8">
            <p className="text-neutral-400 text-sm mb-3">
              For detailed documentation, check out the{" "}
              <a 
                href="https://github.com/ilmari-h/envie/blob/main/README.md" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                user guide
              </a>
            </p>
          </div>
        </div>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium md:ml-64">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
