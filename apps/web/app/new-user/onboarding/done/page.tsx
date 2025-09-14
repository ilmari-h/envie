"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';

export default function DonePage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check URL parameters for Stripe redirect
    const successParam = searchParams.get('success');
    const canceledParam = searchParams.get('canceled');
    const sessionIdParam = searchParams.get('session_id');

    if (successParam === 'true' && sessionIdParam) {
      setSuccess(true);
      setSessionId(sessionIdParam);
    } else if (canceledParam === 'true') {
      setCanceled(true);
    }
  }, [searchParams]);

  const handleManageBilling = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        }),
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

  const handleContinueToApp = () => {
    // Clear onboarding data and redirect to main app
    localStorage.removeItem('envie-plan-selection');
    localStorage.removeItem('envie-onboarding');
    localStorage.removeItem('envie-organization-name');
    localStorage.removeItem('envie-project-name');
    
    // Redirect to main app (adjust URL as needed)
    window.location.href = '/';
  };

  if (canceled) {
    return (
      <div className="flex flex-col h-screen h-full">
        <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
          <h2 className="font-mono text-neutral-100">Payment canceled</h2>
          <p className="text-neutral-400 text-xs mb-4 font-mono text-center">
            Your payment was canceled. You can continue setting up your account or try again later.
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={() => router.back()}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded text-xs transition-colors"
            >
              Go Back
            </button>
            <button 
              onClick={handleContinueToApp}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded text-xs transition-colors"
            >
              Continue to App
            </button>
          </div>
        </main>
        <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
          © {new Date().getFullYear()} envie
        </footer>
      </div>
    );
  }

  if (success && sessionId) {
    return (
      <div className="flex flex-col h-screen h-full">
        <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
          <div className="w-12 h-12 bg-green-900/20 border border-green-500/30 rounded-full flex items-center justify-center mb-2">
            <Check className="w-6 h-6 text-green-400" />
          </div>
          
          <h2 className="font-mono text-neutral-100">Welcome to Envie!</h2>
          <p className="text-neutral-400 text-xs mb-4 font-mono text-center">
            Your subscription is active and your account is ready to use.
          </p>
          
          <div className="flex gap-2">
            <button 
              onClick={handleManageBilling}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded text-xs transition-colors"
            >
              Manage Billing
            </button>
            <button 
              onClick={handleContinueToApp}
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded text-xs transition-colors"
            >
              Continue to App
            </button>
          </div>
        </main>
        <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
          © {new Date().getFullYear()} envie
        </footer>
      </div>
    );
  }

  // Default success page for free plans or direct navigation
  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
        <div className="w-12 h-12 bg-green-900/20 border border-green-500/30 rounded-full flex items-center justify-center mb-2">
          <Check className="w-6 h-6 text-green-400" />
        </div>
        
        <h2 className="font-mono text-neutral-100">Welcome to Envie!</h2>
        <p className="text-neutral-400 text-xs mb-4 font-mono text-center">
          Your account is ready to use.
        </p>
        
        <button 
          onClick={handleContinueToApp}
          className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded text-xs transition-colors"
        >
          Continue to App
        </button>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
