import EditProjectContent from "./content";

export default async function EditProjectPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  return <EditProjectContent id={id} />;
}