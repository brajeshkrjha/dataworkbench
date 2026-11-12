import { PageHeader } from "@/components/shared/page-header";
import { FeatureCatalog } from "@/features/text-compare/components/feature-catalog";
import { TrackRecentTool } from "@/features/tools/components/track-recent-tool";

export default function TextCompareUtilityPage() {
  return (
    <div>
      <TrackRecentTool toolId="text-compare-utility" />
      <PageHeader
        title="Text Compare Utility"
        description="Compare texts and lists side-by-side and clean up text before you reuse it."
        breadcrumbs={[{ label: "Text Compare Utility" }]}
      />
      <FeatureCatalog />
    </div>
  );
}
