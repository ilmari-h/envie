"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrganizationForm } from "../organization-form";
import { tsr } from "../../../tsr";

export default function NewOrganization() {
  const router = useRouter();
  const queryClient = tsr.useQueryClient()
  const { mutateAsync: createOrganization } = tsr.organizations.createOrganization.useMutation()

  return (
    <div>
      <main className="flex flex-col mt-8 gap-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:text-neutral-400 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h3 className="font-mono">New Organization</h3>
        </div>

        <OrganizationForm 
          onSubmit={async (data) => {
            await createOrganization({ body: data })
            await queryClient.invalidateQueries({ queryKey: ['organizations'] })
            router.push("/dashboard");
          }}
        />
      </main>
    </div>
  );
}
