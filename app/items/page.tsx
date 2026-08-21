import DashboardPage from "../dashboard-page";

type ItemsPageProps = {
  searchParams: Promise<{ q?: string | string[]; attention?: string | string[]; space?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams;
  const space = first(params.space);
  return <DashboardPage view="items" initialQuery={first(params.q) || space} initialAttentionOnly={first(params.attention) === "1"} initialSpace={space} />;
}
