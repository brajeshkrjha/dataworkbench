import { PageHeader } from "@/components/shared/page-header";
import { ExploreModule } from "@/features/looker/modules/explore/explore-module";

export default function ExplorePage() {
  return (
    <div>
      <PageHeader
        title="Explore PBIP Structure"
        description="Understand a PBIP project's tables, measures, relationships, and lineage."
        breadcrumbs={[
          { label: "GCP Looker Utility", href: "/tools/gcp-looker-utility" },
          { label: "Explore PBIP Structure" },
        ]}
      />
      <ExploreModule />
    </div>
  );
}
