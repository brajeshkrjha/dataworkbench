import { PageHeader } from "@/components/shared/page-header";
import { FeatureCatalog } from "@/features/parquet/components/feature-catalog";
import { TrackRecentTool } from "@/features/tools/components/track-recent-tool";

export default function ParquetUtilityPage() {
  return (
    <div>
      <TrackRecentTool toolId="parquet-utility" />
      <PageHeader
        title="Parquet Utility"
        description="A collection of tools for converting, exploring, and analyzing Apache Parquet datasets."
        breadcrumbs={[{ label: "Parquet Utility" }]}
      />
      <FeatureCatalog />
    </div>
  );
}
