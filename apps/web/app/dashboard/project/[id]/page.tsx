import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { tsr } from '../../../tsr';
import ProjectContent from './content';

export default async function ProjectPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const queryClient = new QueryClient();
  const tsrQueryClient = tsr.initQueryClient(queryClient);

  await tsrQueryClient.projects.getProject.prefetchQuery({
    queryKey: ['project', id],
    queryData: { params: { id } }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectContent id={id} />
    </HydrationBoundary>
  );
}