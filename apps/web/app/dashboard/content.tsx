"use client";

import { Select } from "@repo/ui/select";
import { tsr } from "../tsr";
import { Bar } from "@repo/ui/bar";
import { Button } from "@repo/ui/button";
import Link from "next/link";
import LoadingScreen from "@repo/ui/loading";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrganizationWithProjectsCount } from "@repo/rest";

export default function Dashboard({ organizationId, organizations }:
    { organizationId?: string, organizations: OrganizationWithProjectsCount[] }) {
  const router = useRouter();
  const { data: user } = tsr.user.getUser.useQuery({
    queryKey: ['user'],
  });
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationWithProjectsCount | null>(
    organizations.find(org => org.id === organizationId)
      ?? organizations.find(org => org.hobby)
      ?? (organizations[0] ?? null)
  );
  const { data: projects, isLoading: isLoadingProjects } = tsr.projects.getProjects.useQuery({
    queryKey: ['projects', selectedOrganization?.id],
    queryData: {
      query: {
        organizationId: selectedOrganization?.id
      }
    }
  });

  if (isLoadingProjects) {
    return <LoadingScreen />;
  }

  return <div>
    <Bar className="flex text-xs items-center justify-between mt-[120px]">
      <span className="text-neutral-400 align-middle ml-4">Logged in as <span className="font-bold">{user?.body.name}</span></span>
    </Bar>
    <main className="flex flex-col mt-8 gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold font-mono">Projects</h2>
        <Link href="/dashboard/project/new">
          <Button variant="accent"><Plus className="w-4 h-4" />New Project</Button>
        </Link>
      </div>
      <div className="flex text-xs items-center justify-between gap-4">
        <div className="flex gap-2 items-center flex-1">
          <span className="text-neutral-400 pr-2">Search:</span>
          <input type="text" placeholder="Search term..." className="max-w-[400px] flex-1 text-xs px-3 py-2 rounded border transition-colors appearance-none bg-right bg-no-repeat bg-neutral-900 hover:bg-neutral-800 border-neutral-800" />
        </div>
        <div className="flex gap-2 items-center justify-end">
          <span className="text-neutral-400 pr-2">Filter by organization:</span>
          <Select
            className="min-w-[120px]"
            allowNone
            options={organizations.map((organization) => ({ value: organization.id, label: organization.name })) || []}
            value={selectedOrganization?.id ?? null}
            onChange={(orgId) => {
              if (orgId) {
              setSelectedOrganization(organizations.find(org => org.id === orgId) ?? null);
              router.push(`/dashboard?organizationId=${orgId}`)
              } else {
                setSelectedOrganization(null);
                router.push(`/dashboard`)
              }
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {projects?.body.map((project) => (
          <Link 
            key={project.id}
            href={`/dashboard/project/${project.id}`}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 h-[80px] hover:bg-neutral-800 hover:border-accent-500 hover:border-[1px] transition-colors"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <h3 className="font-medium text-sm mb-1">{project.name}</h3>
                <p className="text-xs text-neutral-400 line-clamp-2">{project.description || 'No description'}</p>
              </div>
            </div>
          </Link>
        ))}
        {projects?.body.length === 0 && (
          <div className="text-xs text-neutral-400 flex items-center justify-center col-span-full mt-8">
            No projects found for the current filters
          </div>
        )}
      </div>
      
      <div className="mt-8 border-t border-neutral-800 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold font-mono">Organizations</h2>
          <Link href="/dashboard/organization/new">
            <Button variant="accent"><Plus className="w-3 h-3 mr-1" />New Organization</Button>
          </Link>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs text-neutral-400 mb-3">My Organizations</h3>
            <div className="space-y-2">
              {organizations.filter(org => org.createdById === user?.body.id).map((org) => (
                <Link href={`/dashboard/organization/${org.id}`} key={org.id} className="flex items-center justify-between py-2 px-3 bg-neutral-900 hover:bg-neutral-800 hover:border-accent-500 border-[1px] border-neutral-800 rounded-md transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm">{org.name}</span>
                    <p className="text-xs text-neutral-400 line-clamp-1">{org.description || 'No description'}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    {<span className="text-xs text-accent-400">{org.hobby ? "Personal" : <br/>}</span>}
                    <span className="text-xs text-neutral-400">{org.projects} projects</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs text-neutral-400 mb-3">Member Of</h3>
            <div className="space-y-1">
              {organizations.filter(org => org.createdById !== user?.body.id).map((org) => (
                <div key={org.id} className="flex items-center justify-between py-2 px-3 bg-neutral-900 rounded-md transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm">{org.name}</span>
                    <p className="text-xs text-neutral-400 line-clamp-1">{org.description || 'No description'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>;
}