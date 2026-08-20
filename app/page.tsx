import InventoryApp from "./inventory-app";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const username = await getCurrentUser();
  if (!username) redirect("/login");
  return <InventoryApp username={username} />;
}
