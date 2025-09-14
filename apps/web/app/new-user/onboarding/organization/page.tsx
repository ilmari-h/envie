"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tsr } from '../../../tsr';
import { nameSchema, PlanSelection, Onboarding } from '../../schemas';

export default function OrganizationPage() {
  const [organizationName, setOrganizationName] = useState('');
  const [planData, setPlanData] = useState<PlanSelection | null>(null);
  const router = useRouter();

  const [organizationExistsError, setOrganizationExistsError] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    // Read plan selection from localStorage
    const stored = localStorage.getItem('envie-plan-selection');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PlanSelection;
        setPlanData(parsed);
        
        // Redirect free plan users to project page
        if (parsed.plan === 'free') {
          router.push('/new-user/onboarding/project');
          return;
        }

        // Load onboarding data if exists and set default values
        const onboardingStored = localStorage.getItem('envie-onboarding');
        if (onboardingStored) {
          try {
            const onboardingData = JSON.parse(onboardingStored) as Onboarding;
            if (onboardingData.organizationName) {
              setOrganizationName(onboardingData.organizationName);
            }
          } catch (error) {
            console.error('Failed to parse onboarding data:', error);
          }
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

  const handleContinue = async () => {
    const existsResponsee = await tsr.organizations.organizationExists.query({ params: { name: organizationName } });
    const exists = existsResponsee.status === 200 && existsResponsee.body.exists;
    setOrganizationExistsError(exists);
    const validName = nameSchema.safeParse(organizationName);
    const validationError = validName.success ? null : ( validName.error?.issues[0]?.message ?? "Validation error");
    setNameError(validationError);
    if (organizationName && !exists && !validationError) {
      // Save onboarding data using schema
      const onboardingData: Onboarding = {
        organizationName: organizationName,
        projectName: undefined
      };
      localStorage.setItem('envie-onboarding', JSON.stringify(onboardingData));
      
      // Also keep legacy storage for compatibility
      localStorage.setItem('envie-organization-name', organizationName);
      router.push('/new-user/onboarding/project');
    }
  };

  const isValidName = organizationName.length > 0 && nameError === null;

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
        <h2 className="font-mono text-neutral-100">Create an organization</h2>
        <p className="text-neutral-400 text-xs mb-4 font-mono">Choose a unique name for your organization</p>
        
        <div className="w-full max-w-sm">
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="Organization name"
            className=" text-center w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-neutral-100 text-sm font-mono focus:outline-none focus:border-neutral-700 transition-colors"
          />
          
          {organizationExistsError && (
            <div className="mt-2">
                <p className="text-red-400 text-xs font-mono">Organization name already exists</p>
            </div>
          )}

          {nameError && (
            <p className="text-red-400 text-xs font-mono">{nameError}</p>
          )}
        </div>

        <button 
          onClick={handleContinue}
          className="bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 border border-neutral-800 disabled:border-neutral-900 px-3 py-2 rounded text-xs transition-colors mt-2"
        >
          Continue
        </button>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
