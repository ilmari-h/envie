import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '../../../auth/helpers';
import ProjectPage from './content';
import { createTsrClient } from '../../../tsr-server';

export default async function ProjectPageWrapper() {
  const user = await getAuthenticatedUser()
  if(!user) {
    return redirect('/new-user');
  }
  const tsr = await createTsrClient();
  
  // Check if user already has projects and redirect to dashboard if so
  const response = await tsr.projects.getProjects({query: {}});
  if(response.status === 200 && response.body.length > 0) {
    return redirect('/dashboard');
  }
  console.log(response);
  return <ProjectPage />;
}