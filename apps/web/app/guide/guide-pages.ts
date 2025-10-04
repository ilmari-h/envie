export type GuidePage = {
  url: string;
  title: string;
  slug: string;
}

export const guidePages: GuidePage[] = [
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/getting-started.md",
   title: "Getting started",
   slug: "getting-started",
 },
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/projects.md",
   title: "Projects",
   slug: "projects",
 },
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/environments.md",
   title: "Environments",
   slug: "environments",
 },
 {
   url: "https://raw.githubusercontent.com/ilmari-h/envie/refs/heads/main/docs/deploy-prod.md",
   title: "Deploy with Envie",
   slug: "deploy-prod",
 },
]