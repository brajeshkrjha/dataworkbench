import { PageHeader } from "@/components/shared/page-header";
import { CompareModule } from "@/features/looker/modules/compare/compare-module";

export default function ComparePage() {
  return (
    <div>
      <PageHeader
        title="Compare LookML Packages"
        description="Diff two generated LookML packages to validate a migration."
        breadcrumbs={[
          { label: "GCP Looker Utility", href: "/tools/gcp-looker-utility" },
          { label: "Compare LookML Packages" },
        ]}
      />
      <CompareModule />
    </div>
  );
}
