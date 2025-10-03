"use client";

import React from 'react';
import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@repo/ui/button';

export default function NewUserPage() {
  const features = [
    {
      name: 'Price',
      free: "Free forever",
      team: "Starting at $5 per month"
    },
    {
      name: 'Unlimited environments',
      free: true,
      team: true
    },
    {
      name: 'Unlimited projects',
      free: true,
      team: true
    },
    {
      name: 'Version control',
      free: true,
      team: true
    },
    {
      name: 'Organizations',
      free: '1 for personal use',
      team: 'Create up to 3 custom team organizations'
    },
    {
      name: 'Share environments with team members',
      free: false,
      team: true
    },
    {
      name: 'First access to new features',
      free: false,
      team: true
    }
  ];

  return (
    <div >
      <main className="flex flex-col items-center justify-start h-full overflow-hidden">
        <div className="relative w-full py-12 mb-8 min-h-[217px] flex items-center justify-center"
             style={{
               backgroundImage: `
                 linear-gradient(to right, rgba(156, 163, 175, 0.08) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(156, 163, 175, 0.08) 1px, transparent 1px)
               `,
               backgroundSize: '24px 24px'
             }}
        >
          <div className="relative text-center px-4">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              How do you want to use envie?
            </h1>
            <p className="text-neutral-400 text-sm">
              Select the plan that best fits your needs
            </p>
          </div>
        </div>
        
        <div className="w-full max-w-6xl px-4">

            <div className="w-full max-w-4xl mx-auto">
              
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 gap-4 p-4 bg-neutral-800">
                  <div className="text-sm font-medium text-neutral-300">Feature</div>
                  <div className="text-sm font-medium text-neutral-300 text-center">Free</div>
                  <div className="text-sm font-medium text-neutral-300 text-center">Team</div>
                </div>
                
                <div className="divide-y divide-neutral-800">
                  {features.map((feature, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4">
                      <div className="text-sm text-neutral-300 p-4">{feature.name}</div>
                      <div className="flex justify-center p-4">
                        {typeof feature.free === 'boolean' ? (
                          feature.free ? (
                            <Check className="w-4 h-4 text-accent-400" />
                          ) : (
                            <X className="w-4 h-4 text-neutral-600" />
                          )
                        ) : (
                          <span className="text-xs text-neutral-400 text-center">{feature.free}</span>
                        )}
                      </div>
                      <div className="flex justify-center bg-accent-500/5 p-4">
                        {typeof feature.team === 'boolean' ? (
                          feature.team ? (
                            <Check className="w-4 h-4 text-accent-400" />
                          ) : (
                            <X className="w-4 h-4 text-neutral-600" />
                          )
                        ) : (
                          <span className="text-xs text-center">{feature.team}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <Link href="/onboarding/project-and-organization?isFree=true">
              <Button variant="regular" className="min-w-[180px]">
                Continue with Free Plan
              </Button>
            </Link>
            <Link href="/onboarding/project-and-organization">
              <Button variant="accent" className="min-w-[180px]">
                Continue with Team Plan
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}