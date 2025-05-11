"use client";

import { ComponentProps } from "react";
import { Button } from "@repo/ui/button";
import { X, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { tsr } from "../../../tsr";
import { Select } from "@repo/ui/select";
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

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

const Badge = ({ children, className = "" }: BadgeProps) => (
  <div className={`inline-flex px-2 py-1 rounded-full text-xs bg-neutral-800 text-neutral-200 ${className}`}>
    {children}
  </div>
);

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string(),
  environments: z.array(z.string()).min(1, "At least one environment is required"),
  organizationId: z.string().min(1, "Organization is required"),
});


export default function NewProject() {
  const { data: organizations, isLoading: isLoadingOrganizations } = tsr.organizations.getOrganizations.useQuery({
    queryKey: ['organizations'],
  });
  
  const { mutateAsync: createProject } = tsr.projects.createProject.useMutation();

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      environments: ["prod", "staging", "dev"],
      organizationId: organizations?.body[0]?.id || "",
    },
    validators: {
      onChange: projectFormSchema,
    },
    onSubmit: async ({ value }) => {
      await createProject({
        body: {
          name: value.name,
          description: value.description,
          organizationId: value.organizationId,
        }
      });
      console.log("Project created");
    },
  });

  return (
    <div>
      <main className="flex flex-col mt-8 gap-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:text-neutral-400 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h3 className="font-mono">New Project</h3>
        </div>

        <form.Field
          name="name"
          children={(field) => (
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Project Name</label>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Enter project name..."
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
                placeholder="Enter project description..."
                className="w-full min-h-[80px] max-h-[200px]"
              />
            </div>
          )}
        />

        <form.Field
          name="environments"
          children={(field) => {
            const addEnvironment = (newEnv: string) => {
              if (newEnv && !field.state.value.includes(newEnv)) {
                field.handleChange([...field.state.value, newEnv]);
              }
            };

            const removeEnvironment = (env: string) => {
              field.handleChange(field.state.value.filter((e) => e !== env));
            };

            return (
              <div className="space-y-2">
                <label className="text-xs text-neutral-400">Environments</label>
                <div className="flex flex-wrap gap-2">
                  {field.state.value.map((env) => (
                    <Badge key={env} className="flex items-center gap-1">
                      {env}
                      <button
                        type="button"
                        onClick={() => removeEnvironment(env)}
                        className="hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add environment..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEnvironment(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <Button
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      addEnvironment(input.value);
                      input.value = "";
                    }}
                    variant="regular"
                  >
                    Add
                  </Button>
                </div>
                {field.state.meta.errors && (
                  <span className="text-xs text-red-500">{field.state.meta.errors.map((error) => error?.message).join(", ")}</span>
                )}
              </div>
            );
          }}
        />

        <form.Field
          name="organizationId"
          children={(field) => (
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Organization</label>
              <Select
                className="w-full"
                options={organizations?.body.map((org) => ({ value: org.id, label: org.name })) || []}
                value={field.state.value}
                onChange={(value) => field.handleChange(value)}
              />
              {field.state.meta.errors && (
                <span className="text-xs text-red-500">{field.state.meta.errors.map((error) => error?.message).join(", ")}</span>
              )}
            </div>
          )}
        />

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              disabled={!canSubmit || isLoadingOrganizations || isSubmitting}
              onClick={() => form.handleSubmit()}
              className="mt-4"
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          )}
        />
      </main>
    </div>
  );
}
