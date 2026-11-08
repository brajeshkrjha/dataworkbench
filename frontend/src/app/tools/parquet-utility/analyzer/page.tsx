import { PageHeader } from "@/components/shared/page-header";
import { AnalyzerModule } from "@/features/parquet/modules/analyzer/analyzer-module";

export default function AnalyzerPage() {
  return (
    <div>
      <PageHeader
        title="Parquet Analyzer"
        description="Inspect schema, metadata, statistics, profiling, sampling, and storage in one workspace."
        breadcrumbs={[
          { label: "Parquet Utility", href: "/tools/parquet-utility" },
          { label: "Parquet Analyzer" },
        ]}
      />
      <AnalyzerModule />
    </div>
  );
}
