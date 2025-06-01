import { notFound } from "next/navigation";
import { tsr } from "../tsr";
import Dashboard from "./content";
import { cookies } from 'next/headers'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  const tokenCookie = (await cookies()).get('envie_token')

  const organizationsData = await tsr.organizations.getOrganizations.query({
    extraHeaders: {
      "Cookie": `envie_token=${tokenCookie?.value}`
    },
    fetchOptions: {
      credentials: 'include'
    }
  });
  if (organizationsData.status !== 200) {
    return <div>Error loading organizations</div>;
  }

  // Check that the organizationId is valid
  if (organizationId && !organizationsData.body.some(org => org.id === organizationId)) {
    return notFound()
  }

  return <Dashboard organizationId={organizationId} organizations={organizationsData.body} />;
}