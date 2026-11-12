import { PageHeader } from "@/components/shared/page-header";
import { ListsModule } from "@/features/text-compare/modules/lists/lists-module";

export default function CompareListsPage() {
  return (
    <div>
      <PageHeader
        title="Compare Lists"
        description="Find what is only in A, only in B, or in both lists."
        breadcrumbs={[
          { label: "Text Compare Utility", href: "/tools/text-compare-utility" },
          { label: "Compare Lists" },
        ]}
      />
      <ListsModule />
    </div>
  );
}
