import { PageHeader } from "@/components/shared/page-header";
import { TextCompareModule } from "@/features/text-compare/text-compare-module";
import { TrackRecentTool } from "@/features/tools/components/track-recent-tool";

export default function TextCompareUtilityPage() {
  return (
    <div>
      <TrackRecentTool toolId="text-compare-utility" />
      <PageHeader
        title="Text Compare Utility"
        description="Compare text, CSV, JSON, YAML, XML, SQL, and LookML content with structural intelligence."
        breadcrumbs={[{ label: "Text Compare Utility" }]}
      />
      <TextCompareModule />
    </div>
  );
}
