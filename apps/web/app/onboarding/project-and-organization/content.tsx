"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import type { AnyFieldApi } from '@tanstack/react-form';
import { nameSchema, PlanSelection } from '../schemas';
import { tsr } from '../../tsr';
import { recordConversion } from '../../tracker';
import { Button } from '@repo/ui/button';
import { Switch } from '@repo/ui/switch';
import { Input } from '@repo/ui/input';
import { NumberInput } from '@repo/ui/number-input';
import Link from 'next/link';
import { Users } from 'lucide-react';

function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid ? (
        <em className="text-red-400 text-xs mt-2">{field.state.meta.errors.join(', ')}</em>
      ) : null}
      {field.state.meta.isValidating ? <span className="text-neutral-400 text-xs">Validating...</span> : null}
    </>
  );
}

export default function ProjectAndOrganizationContent({ 
  personalOrgName,
  email,
  isFree
}: { 
  personalOrgName: string | null,
  email: string | null,
  isFree: boolean
}) {
  const [planData, setPlanData] = useState<PlanSelection | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const router = useRouter();
  const { mutateAsync: createProject } = tsr.projects.createProject.useMutation();

  const form = useForm({
    defaultValues: {
      organizationName: '',
      teamSize: 5,
      email: email ?? '',
    },
    onSubmit: async ({ value }) => {
      
      if (isFree) {
        // Create project in personal organization
        if (!personalOrgName) {
          throw new Error('User has no personal organization');
        }

        recordConversion(0);
        await createProject({
          body: {
            name: 'default-project', // Default project name for free users
            description: '',
            organizationIdOrName: personalOrgName,
          },
        });
        router.push('/dashboard');
      } else {
        // Start Stripe checkout flow
        setIsProcessingPayment(true);
        try {
          const quantity = Math.max(1, value.teamSize - 2);
          
          recordConversion(quantity * 5);
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              quantity: quantity,
              organizationName: value.organizationName,
              projectName: 'default-project',
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
        }
      }
    },
  });

  useEffect(() => {
    // Read plan selection from localStorage
    const stored = localStorage.getItem('envie-plan-selection');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PlanSelection;
        setPlanData(parsed);
        
        // Load onboarding data if exists and set default values
        const onboardingStored = localStorage.getItem('envie-onboarding');
        if (onboardingStored) {
          try {
            const onboardingData = JSON.parse(onboardingStored);
            form.setFieldValue('organizationName', onboardingData.organizationName || '');
            form.setFieldValue('teamSize', parsed.teamSize);
            form.setFieldValue('email', onboardingData.email || '');
          } catch (error) {
            console.error('Failed to parse onboarding data:', error);
          }
        } else {
          form.setFieldValue('teamSize', parsed.teamSize);
        }
      } catch (error) {
        console.error('Failed to parse plan data:', error);
        router.push('/onboarding');
      }
    } else {
      // No plan data, redirect back to plan selection
      router.push('/onboarding');
    }
  }, [router, form]);

  const calculatePrice = (teamSize: number): number => {
    // $5 for 3 members, $5 for each additional member
    return (teamSize - 2) * 5;
  };

  const handleTeamSizeChange = (newTeamSize: number) => {
    form.setFieldValue('teamSize', newTeamSize);
    if (planData) {
      const updatedPlanData: PlanSelection = {
        ...planData,
        teamSize: newTeamSize
      };
      localStorage.setItem('envie-plan-selection', JSON.stringify(updatedPlanData));
      setPlanData(updatedPlanData);
    }
  };

  if (!planData) {
    return (
      <div>
        <main className="flex flex-col items-center justify-center gap-3 h-full px-4">
          <p className="text-neutral-400 text-xs">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div>
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
              {isFree ? 'Create your first project' : 'Configure your organization'}
            </h1>
            <p className="text-neutral-400 text-sm">
              {isFree 
                ? 'Set up your first project and start managing your environment variables' 
                : 'Configure your organization and first project'}
            </p>
          </div>
        </div>
        
        <div className="w-full max-w-2xl px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-8"
          >
            {/* Organization Section */}
            <div>
              <div className="mb-2">
                <h2 className="text-lg text-neutral-100 mb-2">
                  {isFree ? 'Your Organization' : 'Organization Name'}
                </h2>
                <p className="text-neutral-400 text-xs">
                  {isFree 
                    ? 'This is your personal organization included in the free plan.' 
                    : 'Choose a unique name for your organization.'}
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Organization Display/Input */}
                {isFree ? (
                  <Input
                    value={personalOrgName ?? ''}
                    disabled={true}
                    className="text-center"
                  />
                ) : (
                  <form.Field
                    name="organizationName"
                    validators={{
                      onChange: ({ value }) => {
                        if (!value) return 'Organization name is required';
                        const validName = nameSchema.safeParse(value);
                        return validName.success ? undefined : validName.error?.issues[0]?.message;
                      },
                      onChangeAsyncDebounceMs: 500,
                      onChangeAsync: async ({ value }) => {
                        if (!value) return undefined;
                        try {
                          const existsResponse = await tsr.organizations.organizationExists.query({ 
                            params: { name: value } 
                          });
                          const exists = existsResponse.status === 200 && existsResponse.body.exists;
                          return exists ? 'Organization name already exists' : undefined;
                        } catch (error) {
                          return 'Failed to check organization name';
                        }
                      },
                    }}
                    children={(field) => (
                      <div>
                        <Input
                          type="text"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="my-organization"
                          className="text-center"
                        />
                        <FieldInfo field={field} />
                      </div>
                    )}
                  />
                )}
                
                {/* Team Size for Paid Plan */}
                {!isFree && (
                  <div className="mt-4">
                    <h2 className="text-lg text-neutral-100 mb-2">
                      Team Size
                    </h2>
                    <p className="text-neutral-400 text-xs">
                      Choose the number of seats in your organization.
                    </p>

                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <NumberInput
                          value={form.getFieldValue('teamSize')}
                          onChange={handleTeamSizeChange}
                          min={3}
                          max={1000}
                          icon={<Users className="w-4 h-4" />}
                          size="md"
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-neutral-100">
                          ${calculatePrice(form.getFieldValue('teamSize'))}
                        </div>
                        <div className="text-sm text-neutral-400">
                          per month
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isFree && (
                  <div className="text-neutral-400 text-xs">
                    <p>Want a custom organization name and the ability to invite others to collaborate?</p>
                    <Link href="/onboarding/project-and-organization" className="text-accent-600">Switch to a paid plan</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-neutral-800 my-8"></div>

            {/* Email Section */}
            <div>
              <div className="mb-6">
                <h2 className="text-lg text-neutral-100 mb-2">
                  Email
                </h2>
                <p className="text-neutral-400 text-xs">
                  Please enter your email address.
                </p>
              </div>
              
              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return 'Email is required';
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return emailRegex.test(value) ? undefined : 'Please enter a valid email address';
                  },
                }}
                children={(field) => (
                  <div>
                    <Input
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="your@email.com"
                      className="text-center"
                    />
                    <FieldInfo field={field} />
                  </div>
                )}
              />
            </div>

            <div className="flex justify-center mt-10">
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button 
                    type="submit"
                    disabled={!canSubmit || isProcessingPayment}
                    className="min-w-[200px]"
                    variant={isFree ? 'regular' : 'accent'}
                  >
                    {isProcessingPayment ? 'Processing...' : isSubmitting ? 'Submitting...' : isFree ? 'Continue' : 'Continue to Payment'}
                  </Button>
                )}
              />
            </div>
          </form>
        </div>
      </main>
      <footer className="p-2 text-[10px] text-neutral-600 text-center font-medium">
        © {new Date().getFullYear()} envie
      </footer>
    </div>
  );
}