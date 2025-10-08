export type GuidePage = {
  title: string;
  slug: string;
  children?: GuidePage[];
}

export const baseUrl = "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs";

export const guidePages: GuidePage[] = [
 {
   title: "Getting started",
   slug: "getting-started",
 },
 {
   title: "Projects",
   slug: "projects",
   children: [
    {
      title: "Creating a project",
      slug: "creating-a-project",
    },
   ]
 },
 {
   title: "Environments",
   slug: "environments",
   children: [
    {
      title: "Environment basics",
      slug: "environment-basics",
    },
    {
      title: "Using environments",
      slug: "using-environments",
    },
    {
      title: "Updating environments",
      slug: "updating-environments",
    },
    {
      title: "Access control",
      slug: "access-control",
    },
    {
      title: "Dev environments",
      slug: "dev-environments",
    },
    {
      title: "Version history",
      slug: "version-history",
    },
   ]
 },
 {
   title: "Organizations",
   slug: "organizations",
   children: [
    {
      title: "Invite users",
      slug: "invite-users",
    },
   ]
 },
 {
   title: "Configuration",
   slug: "configuration",
   children: [
    {
      title: "Local configuration",
      slug: "local-configuration",
    },
    {
      title: "Workspaces",
      slug: "workspaces",
    },
   ]
 },
 {
   title: "Deploy with Envie",
   slug: "deploy-with-envie",
   children: [
    {
      title: "Access tokens",
      slug: "access-tokens",
    },
   ]
 },
 {
   title: "Self-hosting",
   slug: "self-hosting",
   children: [
    {
      title: "Host Envie with Docker",
      slug: "host-with-docker",
    },
   ]
 },
]