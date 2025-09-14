import { z } from "zod";

export const planSelectionSchema = z.object({
  plan: z.enum(["free", "team"]),
  teamSize: z.number().min(3).max(10),
});
export type PlanSelection = z.infer<typeof planSelectionSchema>;

export const nameSchema = z.string().min(1).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain latin letters, numbers, underscores and hyphens');

export const onboardingSchema = z.object({
  organizationName: nameSchema.optional(),
  projectName: nameSchema.optional(),
});
export type Onboarding = z.infer<typeof onboardingSchema>;