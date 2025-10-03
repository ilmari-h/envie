import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '../../auth/helpers';
import ProjectAndOrganizationContent from './content';
import { createTsrClient } from '../../tsr-server';

export default async function ProjectAndOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string, isFree?: string }>
}) {
  const { checkout, isFree } = await searchParams;
  const user = await getAuthenticatedUser();
  if (!user) {
    return redirect('/onboarding');
  }
  
  const tsr = await createTsrClient();
  
  // Check if user already has projects and redirect to dashboard if so
  const response = await tsr.projects.getProjects({ query: {} });
  if (response.status === 200 && response.body.length > 0 && !checkout) {
    return redirect('/dashboard');
  }

  // Get user's personal organization for free plan users
  const organizations = await tsr.organizations.getOrganizations({});
  const personalOrgName = organizations.status === 200 && organizations.body[0]?.name 
    ? organizations.body[0].name 
    : null;

  return <ProjectAndOrganizationContent
    personalOrgName={personalOrgName}
    email={null} // TODO: get from backend
    isFree={isFree === 'true'}
  />;
}

