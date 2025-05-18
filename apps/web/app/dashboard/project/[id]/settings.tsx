"use client";

import { useState, useMemo } from "react";
import { Button } from "@repo/ui/button";
import { X, Search } from "lucide-react";
import { cn } from "@sglara/cn";
import { Toggle } from "@repo/ui/toggle";
import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import type { User } from "@repo/db";
import { tsr } from '../../../tsr';

interface SettingsProps {
  environmentId: string;
  name: string;
  className?: string;
  accessControl: {
    projectWide: boolean;
    users?: User[];
  };
  projectUsers: User[];
  preserveVersions: number;
}

const settingsFormSchema = z.object({
  name: z.string().min(1, "Environment name is required"),
  preserveVersions: z.string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val), "Must be a number")
    .refine((val) => val >= 5, "Must be at least 5 versions")
    .refine((val) => val <= 100, "Cannot exceed 100 versions"),
  projectWide: z.boolean(),
  userIds: z.array(z.string()),
});

function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <div className="text-xs text-red-400 mt-1">{field.state.meta.errors.join(", ")}</div>
      ) : null}
    </>
  );
}

export function Settings({
  environmentId,
  name: initialName,
  accessControl: initialAccessControl,
  preserveVersions: initialPreserveVersions,
  projectUsers,
  className
}: SettingsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { mutate: updateEnvironmentSettings } = tsr.environments.updateEnvironmentSettings.useMutation({

  });

  const form = useForm({
    defaultValues: {
      name: initialName,
      preserveVersions: initialPreserveVersions.toString(),
      projectWide: initialAccessControl.projectWide,
      userIds: initialAccessControl.users?.map(user => user.id) || [],
    },
    validators: {
      onChange: settingsFormSchema,
    },
    onSubmit: async ({ value }) => {
      // TODO: Handle form submission
      updateEnvironmentSettings({
        params: { id: environmentId },
        body: {
          allowedUserIds: value.projectWide ? [] : value.userIds,
          preserveVersions: parseInt(value.preserveVersions, 10)
        },
      });
    }
  });

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return projectUsers.filter(
      user => 
        !form.state.values.userIds.includes(user.id) &&
        (user.name.toLowerCase().includes(query))
    );
  }, [searchQuery, form.state.values.userIds]);

  const addUser = (user: User) => {
    form.setFieldValue("userIds", [...form.state.values.userIds, user.id]);
    setSearchQuery("");
  };

  const removeUser = (userId: string) => {
    form.setFieldValue(
      "userIds", 
      form.state.values.userIds.filter(id => id !== userId)
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className={cn("space-y-6 max-w-2xl mt-2", className)}
    >
      <div className="space-y-4">
        <form.Field
          name="name"
        >
          {(field) => (
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Environment Name</label>
              <input
                disabled={true}
                type="text"
                value={field.state.value}
                className="w-full text-xs px-3 py-2 rounded border transition-colors appearance-none border-neutral-800"
              />
              <FieldInfo field={field} />
            </div>
          )}
        </form.Field>

        <form.Field
          name="preserveVersions"
        >
          {(field) => (
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Version History Preservation</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-24 text-xs px-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
                />
                <span className="text-xs text-neutral-400">versions</span>
              </div>
              <FieldInfo field={field} />
              <p className="text-xs text-neutral-400">Keep between 5 and 100 versions in history</p>
            </div>
          )}
        </form.Field>
      </div>

      <div className="border-t border-neutral-800 pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-neutral-400">Access Control</label>
            <div className="text-xs text-neutral-400">Choose which users can see and edit this environment</div>
          </div>

          <form.Field
            name="projectWide"
          >
            {(field) => (
              <>
                <Toggle
                  checked={field.state.value}
                  onChange={(checked) => {
                    field.handleChange(checked);
                    if (checked) {
                      form.setFieldValue("userIds", []);
                    }
                  }}
                  label="Everyone in project"
                />
                
                {!field.state.value && (
                  <>
                    <div className="relative mt-4">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search users..."
                        className="w-full text-xs pl-8 pr-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
                      />
                      <Search size={14} className="absolute left-2.5 top-2.5 text-neutral-400" />
                      
                      {filteredUsers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-neutral-900 border border-neutral-800 rounded shadow-lg">
                          {filteredUsers.map(user => (
                            <button
                              type="button"
                              key={user.id}
                              onClick={() => addUser(user)}
                              className="w-full px-3 py-2 text-left hover:bg-neutral-800 flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-accent-900 flex items-center justify-center text-xs">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-xs">{user.name}</div>
                                <div className="text-xs text-neutral-400">{user.email}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <form.Subscribe
                      selector={(state) => [state.values.userIds]}
                    >
                      {([userIds]) => (
                        <div className="space-y-2 mt-2">
                          {(userIds ?? []).map(userId => {
                            const user = projectUsers.find(user => user.id === userId);
                            if (!user) return null;
                            return (
                            <div
                              key={userId}
                              className="flex items-center justify-between px-3 py-2 rounded border border-neutral-800 bg-neutral-900"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-accent-900 flex items-center justify-center text-xs">
                                  {user.name.charAt(0)}{user.name.length > 1 ? user.name.charAt(1) : ""}
                                </div>
                                <div>
                                  <div className="text-xs">{user.name}</div>
                                  <div className="text-xs text-neutral-400">{user.email}</div>
                                </div>
                              </div>
                              {(userIds?.length ?? 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeUser(user.id)}
                                  className="text-neutral-400 hover:text-red-400 transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                            )
                          })}
                        </div>
                      )}
                    </form.Subscribe>
                  </>
                )}
              </>
            )}
          </form.Field>
        </div>
      </div>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting, state.isSubmitted]}
      >
        {([canSubmit, isSubmitting, isSubmitted]) => (
          <Button
            disabled={!canSubmit}
            className="w-full"
            type="submit"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
