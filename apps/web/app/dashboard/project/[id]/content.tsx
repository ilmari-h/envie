"use client";

import { tsr } from '../../../tsr';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import LoadingScreen from '@repo/ui/loading';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@repo/ui/button';
import { Select } from '@repo/ui/select';
import { EnvironmentWithLatestVersion } from '@repo/rest';
import { ConfirmDialog } from '@repo/ui/confirm-dialog';
import { useEnvVersion } from '../../../../hooks/use-env-version';
import { cn } from "@sglara/cn";
import { EnvEditor } from './env-editor';
import { Toggle } from '@repo/ui/toggle';
import { parseEnvContent } from './utils';
import { Settings } from './settings';

export default function ProjectContent({ id }: { id: string }) {
  const { data, isLoading } = tsr.projects.getProject.useQuery({
    queryKey: ['project', id],
    queryData: { params: { id } }
  });

  const { data: environments, isLoading: environmentsLoading, refetch: refetchEnvironments } = tsr.environments.getEnvironments.useQuery({
    queryKey: ['environments', id],
    queryData: { query: { projectId: id } },
  });

  const { mutate: createEnvironment } = tsr.environments.createEnvironment.useMutation({
    onSuccess: (data) => {
      refetchEnvironments();
      setActiveEnv(data.body)
    },
  });

  const { mutate: updateEnvironmentContent } = tsr.environments.updateEnvironmentContent.useMutation({
    onSuccess: () => {
      // invalidate other queries
      refetchEnvironments();
    },
  });
  const [activeEnv, setActiveEnv] = useState<EnvironmentWithLatestVersion | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "configure">("content");
  const [textMode, setTextMode] = useState<boolean>(true);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [content, setContent] = useState<string>("");
  const { data: activeVersionData, isLoading: activeVersionLoading } = useEnvVersion(
    activeEnv?.id, activeVersion !== null ? activeVersion : undefined
  );

  useEffect(() => {
    if (activeVersionData) {
      setContent(activeVersionData.content);
    }
  }, [activeVersionData, setContent]);

  const contentChanged = useMemo(() => {
    return (activeVersionData && activeVersionData.content !== content) || (!activeVersionData && content !== "");
  }, [activeVersionData, content]);

  const duplicateKeys = useMemo(() => {
    const vars = parseEnvContent(content);
    const duplicates = vars.filter((v, i, arr) => arr.findIndex(t => t.name === v.name) !== i).map(v => v.name);
    return Array.from(new Set(duplicates));
  }, [content]);
  
  const onSaveClicked = () => {
    if (activeEnv) {
      updateEnvironmentContent({
        params: { id: activeEnv.id },
        body: { content }
      });
    }
  }

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const onCreateEnvironment = (name?: string) => {
    if (!name) return;
    createEnvironment({
      body: {
        name,
        projectId: id,
        content: activeVersionData?.content
      }
    });
    setShowCreateDialog(false);
  };

  // Set first environment as active when data loads
  useEffect(() => {
    const envs = environments?.body;
    const selectedEnv = activeEnv ? envs?.find(e => e.id === activeEnv?.id) : envs?.[0];
    if (selectedEnv) {
        setActiveEnv(selectedEnv);
      setActiveVersion(selectedEnv.latestVersion?.versionNumber ?? null);
    }
  }, [environments, activeEnv]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!data) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-red-400 text-sm font-mono">Project not found</div>
    </div>;
  }

  const project = data.body;

  return (
    <div>
      <main className="flex flex-col mt-8 gap-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:text-neutral-400 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h3 className="font-mono">{project.name}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs text-neutral-400">Description</label>
            <p className="text-sm">{project.description || 'No description provided'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-neutral-400">Created</label>
            <p className="text-sm">{new Date(project.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-neutral-800 pt-4"/> {/* separator */}

        <div className="flex gap-6 items-center justify-start">
          <div>
            <span className="text-neutral-400 pr-2 text-xs">Environment:</span>
            <Select
              className="min-w-[120px]"
              options={environments?.body.map((env) => ({ value: env.id, label: env.name })) || []}
              value={activeEnv?.id || ''}
              onChange={(value) => setActiveEnv(environments?.body.find(env => env.id === value) || null)}
            />
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>Create Environment</Button>
        </div>

        <ConfirmDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onConfirm={onCreateEnvironment}
          title="Create Environment"
          description="Enter a name for the new environment"
          confirmText="Create"
          textInput={{
            label: "Environment Name",
            description: "A unique name for the environment, e.g. dev, prod",
            placeholder: "e.g. dev, prod, dev:john etc."
          }}
        />

        {(activeEnv && activeEnv.latestVersion) ?
        <div className="flex gap-6 items-center justify-start">
            <div>
              <span className="text-neutral-400 pr-2 text-xs">Version:</span>
              <Select
                className="min-w-[120px]"
                options={Array.from({ length: (activeEnv.latestVersion.versionNumber || 1) }, (_, i) => ({
                  value: (i + 1).toString(),
                  label: `v${i + 1}`
                })).reverse()}
                value={activeVersion?.toString() || '1'}
                onChange={(value) => setActiveVersion(parseInt(value, 10))}
              />
          </div>
        </div>
        : null}

        <div className="space-y-4">
          {environmentsLoading ? (
            <>
              <div className="flex gap-2 overflow-x-auto">
                <div className="h-8 w-24 bg-neutral-800 rounded-t animate-pulse"/>
                <div className="h-8 w-28 bg-neutral-800 rounded-t animate-pulse"/>
                <div className="h-8 w-20 bg-neutral-800 rounded-t animate-pulse"/>
              </div>
              <div className="h-[300px] bg-neutral-800 rounded animate-pulse"/>
            </>
          ) : !environments?.body.length ? (
            <div className="text-center py-8 text-neutral-400">
              <p className="text-sm mb-1">No environments found</p>
              <p className="text-xs">Create an environment to store configuration values for this project</p>
            </div>
          ) : (
            <div>
              <div className="flex border-b border-accent-800">
                  <button
                    onClick={() => setActiveTab("content")}
                    className={cn(`px-3 py-1.5 text-xs transition-colors rounded-t-lg`,
                      activeTab === "content" 
                        ? cn( textMode ? 'bg-neutral-900 text-white' : 'bg-transparent text-white', 'border-x border-t border-accent-800 relative after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1px] after:bg-neutral-900') 
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    )}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setActiveTab("configure")}
                    className={cn(`px-3 py-1.5 text-xs transition-colors rounded-t-lg`,
                      activeTab === "configure" 
                        ? 'bg-transparent text-white border-x border-t border-accent-800 relative after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1px] after:bg-neutral-900' 
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    )}
                  >
                    Settings
                  </button>

              </div>


              {activeTab === "content" && activeEnv && activeVersionData && (
                <div
                  key={activeVersionData.versionNumber}
                  className="block"
                >

                  {textMode ? (
                    <textarea
                      className="w-full bg-neutral-900 p-3 font-mono text-sm min-h-[600px] max-h-[900px] focus:outline-none"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      spellCheck={false}
                    />
                  ) : (
                    <EnvEditor className='mt-2' content={content} onChange={setContent} />
                  )}

                  <div className="flex justify-between gap-2 mt-2">
                    <div className="flex gap-2">
                      <Button
                        disabled={!contentChanged || duplicateKeys.length > 0}
                        onClick={onSaveClicked}
                      >
                        Save
                      </Button>
                      <div className={cn("mt-1 text-xs text-neutral-400", contentChanged ? "text-red-400" : "")}>
                        {contentChanged ? "Unsaved changes" : "No unsaved changes"}
                        {duplicateKeys.length > 0 && (
                          <div className="text-xs text-red-400">
                            {duplicateKeys.length} duplicate key(s): {duplicateKeys.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end mb-2">
                      <Toggle
                        checked={!textMode}
                        onChange={(checked) => setTextMode(!checked)}
                        label="Visual Editor"
                      />
                    </div>
                  </div>
                </div>
              )}
              {(activeTab === "configure" && activeEnv )
                && (
                  <div className="overflow-visible">
                    <Settings
                      environmentId={activeEnv.id}
                      name={activeEnv?.name ?? ""}
                      projectUsers={project.users}
                      accessControl={{
                      projectWide: activeEnv.accessControl.projectWide,
                      users: activeEnv.accessControl.users ?? []
                    }}
                    preserveVersions={activeEnv.preservedVersions}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
