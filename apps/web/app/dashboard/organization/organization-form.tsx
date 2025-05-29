"use client";

import { ComponentProps } from "react";
import { Button } from "@repo/ui/button";
import { z } from "zod";
import { useForm } from "@tanstack/react-form";

interface InputProps extends Omit<ComponentProps<'input'>, 'className'> {
  className?: string;
}

const Input = ({ className = "", ...props }: InputProps) => (
  <input
    {...props}
    className={`text-xs px-3 py-2 rounded border transition-colors appearance-none bg-right bg-no-repeat bg-neutral-900 hover:bg-neutral-800 border-neutral-800 ${className}`}
  />
);

interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'className'> {
  className?: string;
}

const Textarea = ({ className = "", ...props }: TextareaProps) => (
  <textarea
    {...props}
    className={`text-xs px-3 py-2 rounded border transition-colors appearance-none bg-right bg-no-repeat bg-neutral-900 hover:bg-neutral-800 border-neutral-800 ${className}`}
  />
);

const organizationFormSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string(),
});

interface OrganizationFormProps {
  initialData?: {
    name: string;
    description: string;
  };
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  submitLabel?: string;
}

export function OrganizationForm({ initialData, onSubmit, submitLabel = "Create Organization" }: OrganizationFormProps) {
  const form = useForm({
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
    },
    validators: {
      onChange: organizationFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <div className="space-y-6">
      <form.Field
        name="name"
        children={(field) => (
          <div className="space-y-2">
            <label className="text-xs text-neutral-400">Organization Name</label>
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Enter organization name..."
              className="w-full"
            />
            {field.state.meta.errors && (
              <span className="text-xs text-red-500">{field.state.meta.errors.map((error) => error?.message).join(", ")}</span>
            )}
          </div>
        )}
      />

      <form.Field
        name="description"
        children={(field) => (
          <div className="space-y-2">
            <label className="text-xs text-neutral-400">Description</label>
            <Textarea
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Enter organization description..."
              className="w-full min-h-[80px] max-h-[200px]"
            />
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <Button
            disabled={!canSubmit || isSubmitting}
            onClick={() => form.handleSubmit()}
            className="mt-4"
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        )}
      />
    </div>
  );
}
