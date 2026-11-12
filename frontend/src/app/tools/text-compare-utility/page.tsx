import { PageHeader } from "@/components/shared/page-header";
import { TextCompareModule } from "@/features/text-compare/text-compare-module";
import { TrackRecentTool } from "@/features/tools/components/track-recent-tool";

export default function TextCompareUtilityPage() {
  return (
    <div>
      <TrackRecentTool toolId="text-compare-utility" />
      <PageHeader
        title="Text Compare Utility"
        description="Compare two texts side-by-side and see every difference."
        breadcrumbs={[{ label: "Text Compare Utility" }]}
      />
      <TextCompareModule />
    </div>
  );
}
