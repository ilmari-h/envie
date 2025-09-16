"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check } from 'lucide-react';
import { tsr } from '../tsr';
import Sidebar from '../components/sidebar';

export default function Dashboard() {
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  
  // Fetch user data to check if they're on paid plan
  const { data: userResponse, isLoading } = tsr.user.getUser.useQuery({
    queryKey: ['user'],
  });

  const isPaidUser = (userResponse?.body?.limits?.maxOrganizations ?? 1) > 1;

  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to create portal session:', data.error);
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText('envie login');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleUpgrade = () => {
    router.push('/new-user');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen h-full">
        <Sidebar />
        <main className="flex flex-col items-center justify-center gap-3 h-full px-4 md:ml-64">
          <div className="text-neutral-400 font-mono text-sm">Loading...</div>
        </main>
        <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium md:ml-64">
          © {new Date().getFullYear()} envie
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-full">
      <Sidebar />
      <main className="flex flex-col items-center justify-center gap-6 h-full px-4 md:ml-64">
        <h2 className="font-mono text-neutral-100 text-lg">Welcome to Envie</h2>
        
        {/* Command Window */}
        <div className="font-mono text-sm max-w-md w-full">
          <div className="text-neutral-400 text-xs mb-3 text-center">To get started with the CLI, run:</div>
          <div className="flex items-center justify-between bg-black border border-neutral-700 rounded px-3 py-2">
            <span className="text-neutral-100">envie login</span>
            <button
              onClick={copyToClipboard}
              className="ml-3 p-1 hover:bg-neutral-800 rounded transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-neutral-400" />
              )}
            </button>
          </div>
          <div className="mt-3 text-center">
            <a 
              href="https://github.com/ilmari-h/envie" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-neutral-300 text-xs underline transition-colors"
            >
              View user guide
            </a>
          </div>
        </div>

        {/* Billing/Upgrade Section */}
        {isPaidUser ? (
          <button 
            onClick={handleManageBilling}
            className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-4 py-2 rounded text-sm transition-colors font-mono"
          >
            Manage Billing
          </button>
        ) : (
          <button 
            onClick={handleUpgrade}
            className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-4 py-2 rounded text-xs transition-colors font-mono"
          >
            Upgrade Plan
          </button>
        )}
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium md:ml-64">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
