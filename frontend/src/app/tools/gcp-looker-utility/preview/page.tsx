import { PageHeader } from "@/components/shared/page-header";
import { PreviewModule } from "@/features/looker/modules/preview/preview-module";

export default function PreviewPage() {
  return (
    <div>
      <PageHeader
        title="Preview LookML"
        description="Browse generated LookML views and explores before downloading."
        breadcrumbs={[
          { label: "GCP Looker Utility", href: "/tools/gcp-looker-utility" },
          { label: "Preview LookML" },
        ]}
      />
      <PreviewModule />
    </div>
  );
}
