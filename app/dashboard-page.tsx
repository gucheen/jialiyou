import { redirect } from "next/navigation";
import InventoryApp, { type View } from "./inventory-app";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage({ view, initialQuery, initialAttentionOnly, initialSpace }: { view: View; initialQuery?: string; initialAttentionOnly?: boolean; initialSpace?: string }) {
  const username = await getCurrentUser();
  if (!username) redirect("/login");
  return <InventoryApp username={username} view={view} initialQuery={initialQuery} initialAttentionOnly={initialAttentionOnly} initialSpace={initialSpace} />;
}
