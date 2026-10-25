export const dynamic = "force-dynamic";
import { configured } from "@/lib/config";
import { identity } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) redirect("/login?setup=1");
  let email;
  try {
    const { user } = await identity();
    email = user.email || "MYN";
  } catch {
    redirect("/login");
  }
  return <Shell email={email}>{children}</Shell>;
}
