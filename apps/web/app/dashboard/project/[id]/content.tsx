"use client";

import { tsr } from '../../../tsr';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import LoadingScreen from '@repo/ui/loading';
import { useState, useEffect } from 'react';
import { Button } from '@repo/ui/button';

export default function ProjectContent({ id }: { id: string }) {
  const { data, isLoading } = tsr.projects.getProject.useQuery({
    queryKey: ['project', id],
    queryData: { params: { id } }
  });

  const { data: environments, isLoading: environmentsLoading } = tsr.environments.getEnvironments.useQuery({
    queryKey: ['environments', id],
    queryData: { query: { projectId: id } }
  });

  const [activeEnv, setActiveEnv] = useState<string | null>(null);

  // Set first environment as active when data loads
  useEffect(() => {
    const envs = environments?.body;
    if (envs && envs.length > 0 && !activeEnv) {
      setActiveEnv(envs[0]!.id);
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
        <Button>Create Environment</Button>

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
            <div className="overflow-hidden">
              <div className="flex border-b border-neutral-800">
                {environments.body.map(env => (
                  <button
                    key={env.id}
                    onClick={() => setActiveEnv(env.id)}
                    className={`px-3 py-1.5 text-xs transition-colors rounded-t-lg ${
                      activeEnv === env.id 
                        ? 'bg-neutral-900 text-white border-x border-t border-neutral-800 relative after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1px] after:bg-neutral-900' 
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>

              {environments.body.map(env => (
                <div
                  key={env.id}
                  className={activeEnv === env.id ? 'block' : 'hidden'}
                >
                  <textarea
                    className="w-full bg-neutral-900 p-3 font-mono text-sm min-h-[600px] max-h-[900px] focus:outline-none"
                    defaultValue={""}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
