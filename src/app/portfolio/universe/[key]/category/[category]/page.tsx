import { AnalyticsDashboard } from "@/components/portfolio/AnalyticsDashboard";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ key: string; category: string }>;
}) {
  const { key, category } = await params;

  return (
    <AnalyticsDashboard
      scope="category"
      universeKey={key}
      categoryLabel={decodeURIComponent(category)}
    />
  );
}