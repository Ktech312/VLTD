import { AnalyticsDashboard } from "@/components/portfolio/AnalyticsDashboard";

export default async function SubcategoryPage({
  params,
}: {
  params: Promise<{ key: string; category: string; sub: string }>;
}) {
  const { key, category, sub } = await params;

  return (
    <AnalyticsDashboard
      scope="subcategory"
      universeKey={key}
      categoryLabel={decodeURIComponent(category)}
      subcategoryLabel={decodeURIComponent(sub)}
    />
  );
}