"use client";

import { Button } from "@repo/ui/button";
import { Select } from "@repo/ui/select";
import { tsr } from "../tsr";
import { Bar } from "@repo/ui/bar";
export default function Dashboard() {
  const { data, isLoading } = tsr.organizations.getOrganizations.useQuery({
    queryKey: ['organizations'],
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }
  const hasOrganizations = (data?.body || []).length > 0;

  return <div>
    <Bar className="flex text-xs items-center justify-between mt-[120px]">
      <span className="text-neutral-400 align ml-4">Logged in as <span className="font-bold">John Doe</span></span>
      <div className="flex gap-2 items-center justify-end">
        {hasOrganizations && (
          <>
            <span className="text-neutral-400 pr-2">Organization:</span>
            <Select
              options={data?.body.map((organization) => ({ value: organization.id, label: organization.name })) || []}
              value="test"
              onChange={() => {console.log('change org')}}
            />
          </>
        )}
        {!hasOrganizations && (
          <>
            <span className="text-neutral-400 pr-2">No organizations found</span>
            <Button variant="regular">Create Organization</Button>
          </>
        )}
      </div>
    </Bar>
    <main className="mt-4 p-2">
      <h2 className="font-bold font-mono">Projects</h2>
    </main>
  </div>;
}