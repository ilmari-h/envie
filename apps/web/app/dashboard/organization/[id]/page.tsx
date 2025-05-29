"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrganizationForm } from "../organization-form";
import { tsr } from "../../../tsr";

export default function EditOrganization({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = tsr.useQueryClient()
  const { data: organization } = tsr.organizations.getOrganization.useQuery({
    queryKey: ['organization', params.id],
    queryData: { params: { id: params.id } }
  });
  const { mutateAsync: updateOrganization } = tsr.organizations.updateOrganization.useMutation()

  if (!organization) {
    return null; // or loading state
  }

  return (
    <div>
      <main className="flex flex-col mt-8 gap-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:text-neutral-400 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <h3 className="font-mono">Edit Organization</h3>
        </div>

        <OrganizationForm 
          initialData={{
            name: organization.body.name,
            description: organization.body.description || "",
          }}
          submitLabel="Save Changes"
          onSubmit={async (data) => {
            await updateOrganization({ body: data, params: { id: params.id } })
            await queryClient.invalidateQueries({ queryKey: ['organizations'] })
            router.push("/dashboard");
          }}
        />
      </main>
    </div>
  );
}
