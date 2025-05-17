import { tsr } from "../app/tsr";

export const useEnvVersion = (envId: string | undefined, versionNumber: number | undefined) => {
  const { data, isLoading } = tsr.environments.getEnvironmentVersion.useQuery({
    queryKey: ['environmentVersion', envId, versionNumber],
    queryData: { params: { id: envId ?? '', versionNumber: versionNumber?.toString() }},
    enabled: !!envId
  });

  if (!envId) {
    return {
      data: null,
      isLoading: false,
    };
  }

  return {
    data: data?.body,
    isLoading,
  };
};
