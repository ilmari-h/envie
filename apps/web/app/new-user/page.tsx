"use client";

import React, { useState } from 'react';
import { Check, Users, Plus, Minus } from 'lucide-react';
import { env } from "next-runtime-env";
import { PlanSelection } from './schemas';

export default function NewUserPage() {
  const [teamSize, setTeamSize] = useState(3);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'team'>('team');

  const calculatePrice = (size: number) => {
    return (size - 3) * 5 + 5;
  };

  const handleContinue = () => {
    // Save to localStorage
    localStorage.setItem('envie-plan-selection', JSON.stringify({
      plan: selectedPlan,
      teamSize: teamSize
    } satisfies PlanSelection));
    
    // Redirect to auth
    window.location.href = `${env("NEXT_PUBLIC_API_URL")}/auth/github?onboarding=true`;
  };

  return (
    <div className="flex flex-col h-screen h-full">
      <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
        <h2 className="font-mono text-neutral-100">How do you want to use envie?</h2>
        <p className="text-neutral-400 text-xs mb-4 font-mono">Select the plan that best fits your needs</p>
        
        <div className="grid md:grid-cols-2 gap-3 max-w-2xl w-full">
          {/* Free Plan */}
          <div 
            className={`cursor-pointer ${
              selectedPlan === 'free' 
                ? 'bg-neutral-800 border-neutral-700' 
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
            } border rounded p-4 transition-colors`}
            onClick={() => setSelectedPlan('free')}
          >
            <h3 className="font-mono text-sm mb-1">Always Free</h3>
            <p className="text-neutral-400 text-xs mb-2">Personal use</p>
            <div className="font-mono text-sm mb-3">$0</div>
            
            <ul className="space-y-1">
              {[
                'Unlimited environments',
                'Unlimited projects', 
                'Version control',
                'One personal organization'
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span className="text-xs text-neutral-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Team Plan */}
          <div 
            className={`cursor-pointer ${
              selectedPlan === 'team' 
                ? 'bg-neutral-800 border-neutral-700' 
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800'
            } border rounded p-4 transition-colors`}
            onClick={() => setSelectedPlan('team')}
          >
            <h3 className="font-mono text-sm mb-1">Team</h3>
            <p className="text-neutral-400 text-xs mb-2">For teams</p>
            <div className="font-mono text-sm mb-3">${calculatePrice(teamSize)}/mo</div>
            
            <ul className="space-y-1 mb-3">
              {[
                'Share environments with team members',
                'Create up to 3 team organizations',
                'First access to new features',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                  <span className="text-xs text-neutral-300">{feature}</span>
                </li>
              ))}
            </ul>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Team Size</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeamSize(Math.max(3, teamSize - 1));
                  }}
                  className="w-6 h-6 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded flex items-center justify-center transition-colors"
                >
                  <Minus className="w-3 h-3 text-neutral-400" />
                </button>
                <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1">
                  <Users className="w-3 h-3 text-neutral-400" />
                  <input
                    type="number"
                    min="3"
                    value={teamSize}
                    onChange={(e) => {
                      e.stopPropagation();
                      setTeamSize(Math.max(3, parseInt(e.target.value) || 3));
                    }}
                    className="bg-transparent w-8 text-center text-neutral-100 focus:outline-none text-xs font-mono"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeamSize(teamSize + 1);
                  }}
                  className="w-6 h-6 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3 h-3 text-neutral-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleContinue}
          className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded text-xs transition-colors mt-2"
        >
          Continue with {selectedPlan === 'free' ? 'Free Plan' : 'Team Plan'}
        </button>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}
