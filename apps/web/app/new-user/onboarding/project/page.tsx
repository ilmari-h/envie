"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { env } from 'next-runtime-env';
import { nameSchema, PlanSelection, Onboarding } from '../../schemas';

export default function ProjectPage() {
  const [projectName, setProjectName] = useState('');
  const [planData, setPlanData] = useState<PlanSelection | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Read plan selection from localStorage
    const stored = localStorage.getItem('envie-plan-selection');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PlanSelection;
        setPlanData(parsed);
        
        // Load onboarding data if exists
        const onboardingStored = localStorage.getItem('envie-onboarding');
        let onboardingData: Onboarding | null = null;
        if (onboardingStored) {
          try {
            onboardingData = JSON.parse(onboardingStored) as Onboarding;
            // Set default values from saved data
            if (onboardingData.projectName) {
              setProjectName(onboardingData.projectName);
            }
          } catch (error) {
            console.error('Failed to parse onboarding data:', error);
          }
        }
        
        // For team plans, also get organization name
        if (parsed.plan === 'team') {
          const orgName = onboardingData?.organizationName || localStorage.getItem('envie-organization-name');
          if (!orgName) {
            // No organization name, redirect back to organization page
            router.push('/new-user/onboarding/organization');
            return;
          }
          setOrganizationName(orgName);
        }
      } catch (error) {
        console.error('Failed to parse plan data:', error);
        router.push('/new-user');
      }
    } else {
      // No plan data, redirect back to plan selection
      router.push('/new-user');
    }
  }, [router]);

  const calculateStripeQuantity = (teamSize: number): number => {
    // For 3 members: quantity = 1, for 4 members: quantity = 2, etc.
    return Math.max(1, teamSize - 2);
  };

  const handleContinue = async () => {
    const validName = nameSchema.safeParse(projectName);
    const validationError = validName.success ? null : (validName.error?.issues[0]?.message ?? "Validation error");
    setNameError(validationError);
    
    if (projectName && !validationError) {
      // Save onboarding data using schema
      const onboardingData: Onboarding = {
        organizationName: organizationName || undefined,
        projectName: projectName
      };
      localStorage.setItem('envie-onboarding', JSON.stringify(onboardingData));
      
      // Also keep legacy storage for compatibility
      localStorage.setItem('envie-project-name', projectName);
      
      // Handle different flows based on plan
      if (planData?.plan === 'free') {
        router.push('/new-user/onboarding/done');
      } else if (planData?.plan === 'team') {
        // Start Stripe checkout flow
        setIsProcessingPayment(true);
        try {

          const quantity = calculateStripeQuantity(planData.teamSize);
          
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              quantity: quantity,
            }),
          });

          const data = await response.json();
          
          if (response.ok && data.url) {
            // Redirect to Stripe Checkout
            window.location.href = data.url;
          } else {
            throw new Error(data.error || 'Failed to create checkout session');
          }
        } catch (error) {
          console.error('Error starting checkout:', error);
          setIsProcessingPayment(false);
          // You might want to show an error message to the user here
        }
      }
    }
  };

  const handleBack = () => {
    // Save current project name before going back
    if (projectName) {
      const onboardingData: Onboarding = {
        organizationName: organizationName || undefined,
        projectName: projectName
      };
      localStorage.setItem('envie-onboarding', JSON.stringify(onboardingData));
    }
    router.push('/new-user/onboarding/organization');
  };

  const isValidName = projectName.length > 0 && nameError === null;

  if (!planData) {
    return (
      <div className="flex flex-col h-screen h-full">
        <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
          <p className="text-neutral-400 text-xs font-mono">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
        <h2 className="font-mono text-neutral-100">Create a project</h2>
        <p className="text-neutral-400 text-xs mb-4 font-mono">
          Choose a name for your first project{organizationName ? ` in ${organizationName}` : ''}
        </p>
        
        <div className="w-full max-w-sm">
          {planData?.plan === 'team' && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-neutral-400 hover:text-neutral-300 text-xs font-mono mb-3 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to organization
            </button>
          )}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            className="text-center w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-neutral-100 text-sm font-mono focus:outline-none focus:border-neutral-700 transition-colors"
          />
          
          {nameError && (
            <div className="mt-2">
              <p className="text-red-400 text-xs font-mono">{nameError}</p>
            </div>
          )}
        </div>

        <button 
          onClick={handleContinue}
          disabled={isProcessingPayment}
          className="bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 border border-neutral-800 disabled:border-neutral-900 px-3 py-2 rounded text-xs transition-colors mt-2"
        >
          {isProcessingPayment ? 'Processing...' : planData?.plan === 'team' ? 'Continue to Payment' : 'Continue'}
        </button>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
