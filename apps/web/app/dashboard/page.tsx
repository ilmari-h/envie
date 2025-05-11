"use client";

import { Select } from "@repo/ui/select";
import { tsr } from "../tsr";
import { Bar } from "@repo/ui/bar";
import { Button } from "@repo/ui/button";
import Link from "next/link";
import LoadingScreen from "@repo/ui/loading";

export default function Dashboard() {
  const { data, isLoading } = tsr.organizations.getOrganizations.useQuery({
    queryKey: ['organizations'],
  });
  const { data: user } = tsr.user.getUser.useQuery({
    queryKey: ['user'],
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <div>
    <Bar className="flex text-xs items-center justify-between mt-[120px]">
      <span className="text-neutral-400 align-middle ml-4">Logged in as <span className="font-bold">{user?.body.name}</span></span>
    </Bar>
    <main className="flex flex-col mt-8 gap-4">
      <h2 className="font-bold font-mono">Projects</h2>
      <Link href="/dashboard/project/new">
        <Button variant="regular" className="w-full">Create Project</Button>
      </Link>
      <div className="flex text-xs items-center justify-between gap-4">
        <div className="flex gap-2 items-center flex-1">
          <span className="text-neutral-400 pr-2">Search:</span>
          <input type="text" placeholder="Search term..." className="max-w-[400px] flex-1 text-xs px-3 py-2 rounded border transition-colors appearance-none bg-right bg-no-repeat bg-neutral-900 hover:bg-neutral-800 border-neutral-800" />
        </div>
        <div className="flex gap-2 items-center justify-end">
            <span className="text-neutral-400 pr-2">Filter by organization:</span>
            <Select
              className="min-w-[120px]"
              options={data?.body.map((organization) => ({ value: organization.id, label: organization.name })) || []}
              value="all"
              onChange={() => {console.log('change org')}}
            />
        </div>
      </div>
    </main>
  </div>;
}