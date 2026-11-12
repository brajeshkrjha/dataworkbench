import { PageHeader } from "@/components/shared/page-header";
import { TextCompareModule } from "@/features/text-compare/text-compare-module";

export default function CompareTextPage() {
  return (
    <div>
      <PageHeader
        title="Compare Text"
        description="Compare two texts or files side-by-side and see every difference."
        breadcrumbs={[
          { label: "Text Compare Utility", href: "/tools/text-compare-utility" },
          { label: "Compare Text" },
        ]}
      />
      <TextCompareModule />
    </div>
  );
}
