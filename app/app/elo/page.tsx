import { Session } from "@/components/session";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    draft?: string;
    session?: string;
    new?: string;
    intent?: string;
  }>;
}) {
  const q = await searchParams;
  return (
    <Session
      key={q.new || q.session || q.draft || q.message || "elo"}
      mode="wake"
      compact
      initialMessage={q.message?.slice(0, 4000)}
      draftKey={q.draft}
      intent={q.intent}
    />
  );
}
