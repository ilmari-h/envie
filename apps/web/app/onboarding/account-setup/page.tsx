import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '../../auth/helpers';
import AccountSetupContent from './content';
import { createTsrClient } from '../../tsr-server';

export default async function ProjectAndOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ isFree?: string }>
}) {
  const { isFree } = await searchParams;
  const user = await getAuthenticatedUser();
  if (!user) {
    return redirect('/onboarding');
  }
  
  const tsr = await createTsrClient();
  
  const [userResponse, organizationsResponse] = await Promise.all([
    tsr.user!.getUser(),
    tsr.organizations.getOrganizations({})
  ]);

  // Get user's personal organization for free plan users
  const personalOrgName = organizationsResponse.status === 200 && organizationsResponse.body[0]?.name 
    ? organizationsResponse.body[0].name 
    : null;

  const personalOrgNameToShow = isFree === 'true' ? personalOrgName : null;

  return <AccountSetupContent
    personalOrgName={personalOrgNameToShow}
    email={userResponse.status === 200 ? userResponse.body.email : null}
    isFree={isFree === 'true'}
  />;
}

