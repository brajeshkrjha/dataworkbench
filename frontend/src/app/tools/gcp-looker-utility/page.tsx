import { PageHeader } from "@/components/shared/page-header";
import { FeatureCatalog } from "@/features/looker/components/feature-catalog";
import { TrackRecentTool } from "@/features/tools/components/track-recent-tool";

export default function GcpLookerUtilityPage() {
  return (
    <div>
      <TrackRecentTool toolId="gcp-looker-utility" />
      <PageHeader
        title="GCP Looker Utility"
        description="A collection of tools for migrating Power BI PBIP projects to Looker."
        breadcrumbs={[{ label: "GCP Looker Utility" }]}
      />
      <FeatureCatalog />
    </div>
  );
}
