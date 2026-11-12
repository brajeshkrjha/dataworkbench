import { PageHeader } from "@/components/shared/page-header";
import { CleanupModule } from "@/features/text-compare/modules/cleanup/cleanup-module";

export default function CleanUpTextPage() {
  return (
    <div>
      <PageHeader
        title="Clean Up Text"
        description="Trim, dedupe, sort, and normalize case for lines of text."
        breadcrumbs={[
          { label: "Text Compare Utility", href: "/tools/text-compare-utility" },
          { label: "Clean Up Text" },
        ]}
      />
      <CleanupModule />
    </div>
  );
}
