import { Records } from "@/components/records";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Records kind="agents" id={id} />;
}
