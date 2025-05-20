"use client"

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@repo/ui/button";
import { Toggle } from "@repo/ui/toggle";
import { ArrowLeft, X, Check, Copy } from "lucide-react";
import Link from "next/link";
import { tsr } from "../../../../tsr";
import { ConfirmDialog } from "@repo/ui/confirm-dialog";
import type { User } from "@repo/db";
import { useRouter } from "next/navigation";

const editFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string(),
  inviteLink: z.object({
    oneTimeUse: z.boolean(),
    expiresAt: z.date().min(new Date(), "Expiry date must be in the future"),
  }),
});

function FieldInfo({ field }: { field: any }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <div className="text-xs text-red-400 mt-1">{field.state.meta.errors.join(", ")}</div>
      ) : null}
    </>
  );
}

export default function EditProject({ params }: { params: { id: string } }) {
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  const [showRemoveLinksDialog, setShowRemoveLinksDialog] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { data: projectData } = tsr.projects.getProject.useQuery({
    queryKey: ['project', params.id],
    queryData: { params: { id: params.id } }
  });

  const { mutate: updateProject } = tsr.projects.updateProject.useMutation();
  const { mutate: generateInviteLink } = tsr.projects.generateInviteLink.useMutation({
    onSuccess: (data) => {
      setInviteLink(data.body.link);
    }
  });
  const { mutate: removeInviteLinks } = tsr.projects.removeInviteLinks.useMutation({
    onSuccess: () => {
      setInviteLink(null);
    }
  });
  const { mutate: removeUser } = tsr.projects.removeUser.useMutation();
  const { mutate: deleteProject } = tsr.projects.deleteProject.useMutation({
    onSuccess: () => {
      router.push('/dashboard');
    }
  });

  const form = useForm({
    defaultValues: {
      name: projectData?.body.name ?? "",
      description: projectData?.body.description ?? "",
      inviteLink: {
        oneTimeUse: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    },
    validators: {
      onChange: editFormSchema,
    },
    onSubmit: async ({ value }) => {
      updateProject({
        params: { id: params.id },
        body: {
          name: value.name,
          description: value.description,
        },
      });
    }
  });

  const handleGenerateInviteLink = () => {
    generateInviteLink({
      params: { id: params.id },
      body: {
        oneTimeUse: form.state.values.inviteLink.oneTimeUse,
        expiresAt: form.state.values.inviteLink.expiresAt,
      },
    });
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteUserDialog(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      removeUser({
        params: { id: params.id, userId: userToDelete.id },
      });
      setShowDeleteUserDialog(false);
      setUserToDelete(null);
    }
  };

  const handleCopyInviteLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!projectData) return null;

  const project = projectData.body;

  return (
    <div>
      <main className="flex flex-col mt-8 gap-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/project/${params.id}`} className="hover:text-neutral-400 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h3 className="font-mono">Project Settings</h3>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <form.Field
              name="name"
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Project Name</label>
                  <input
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="w-full text-xs px-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
                  />
                  <FieldInfo field={field} />
                </div>
              )}
            </form.Field>

            <form.Field
              name="description"
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Description</label>
                  <textarea
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="w-full text-xs px-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800 h-[80px] min-h-[80px] max-h-[200px]"
                  />
                  <FieldInfo field={field} />
                </div>
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  disabled={!canSubmit}
                  type="submit"
                  className="w-full"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>

        <div className="border-t border-neutral-800 pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Invite Link</label>
              <div className="text-xs text-neutral-400">Generate a link to invite users to this project</div>
            </div>

            <form.Field
              name="inviteLink.oneTimeUse"
            >
              {(field) => (
                <Toggle
                  checked={field.state.value}
                  onChange={(checked) => field.handleChange(checked)}
                  label="One-time use only"
                />
              )}
            </form.Field>

            <form.Field
              name="inviteLink.expiresAt"
            >
              {(field) => (
                <div className="space-y-2">
                  <label className="text-xs text-neutral-400">Expires At</label>
                  <input
                    type="datetime-local"
                    value={field.state.value.toISOString().slice(0, 16)}
                    onChange={(e) => field.handleChange(new Date(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded border transition-colors appearance-none bg-neutral-900 hover:bg-neutral-800 border-neutral-800"
                  />
                  <FieldInfo field={field} />
                </div>
              )}
            </form.Field>

            <Button
              onClick={handleGenerateInviteLink}
              className="w-full"
            >
              Generate Invite Link
            </Button>

            {inviteLink && (
              <div className="flex items-center gap-2 p-3 rounded border border-neutral-800 bg-neutral-900">
                <div className="flex-1 text-xs truncate">{inviteLink}</div>
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="text-neutral-400 hover:text-accent-400 transition-colors"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            )}

            <Button
              onClick={() => setShowRemoveLinksDialog(true)}
              variant="destructive"
              className="w-full"
            >
              Remove All Invite Links
            </Button>
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-neutral-400">Project Members</label>
              <div className="text-xs text-neutral-400">Manage who has access to this project</div>
            </div>

            <div className="space-y-2">
              {project.users.map(user => (
                <div
                  key={user.id}
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
                  {project.users.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      className="text-neutral-400 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800 pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-red-500">Danger Zone</label>
              <div className="text-xs text-neutral-400">Proceed only if you know what you are doing</div>
            </div>

            <Button
              onClick={() => setShowDeleteProjectDialog(true)}
              variant="destructive"
              className="w-full"
            >
              Delete Project
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={showDeleteUserDialog}
          onClose={() => {
            setShowDeleteUserDialog(false);
            setUserToDelete(null);
          }}
          onConfirm={confirmDeleteUser}
          title="Remove User"
          description={`Are you sure you want to remove ${userToDelete?.name} from this project?`}
          confirmText="Remove"
          cancelText="Cancel"
        />

        <ConfirmDialog
          open={showRemoveLinksDialog}
          onClose={() => setShowRemoveLinksDialog(false)}
          onConfirm={() => {
            removeInviteLinks({ params: { id: params.id } });
            setShowRemoveLinksDialog(false);
          }}
          title="Remove All Invite Links"
          description="Are you sure you want to remove all invite links for this project? This action cannot be undone."
          confirmText="Remove All"
          cancelText="Cancel"
        />

        <ConfirmDialog
          open={showDeleteProjectDialog}
          onClose={() => setShowDeleteProjectDialog(false)}
          onConfirm={() => {
            deleteProject({ params: { id: params.id } });
            setShowDeleteProjectDialog(false);
          }}
          title="Delete Project"
          description="Are you sure you want to delete this project? This action cannot be undone and will delete all environments, secrets, and access records."
          confirmText="Delete Project"
          cancelText="Cancel"
        />
      </main>
    </div>
  );
}