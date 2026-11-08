import { PageHeader } from "@/components/shared/page-header";
import { ComparisonModule } from "@/features/parquet/modules/comparison/comparison-module";

export default function ComparisonPage() {
  return (
    <div>
      <PageHeader
        title="Schema Comparison"
        description="Compare two parquet files to detect schema drift and breaking changes."
        breadcrumbs={[
          { label: "Parquet Utility", href: "/tools/parquet-utility" },
          { label: "Schema Comparison" },
        ]}
      />
      <ComparisonModule />
    </div>
  );
}
