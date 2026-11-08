import { PageHeader } from "@/components/shared/page-header";
import { ConvertModule } from "@/features/looker/modules/convert/convert-module";

export default function ConvertPage() {
  return (
    <div>
      <PageHeader
        title="Convert PBIP to LookML"
        description="Select your PBIP project and generate a downloadable LookML package."
        breadcrumbs={[
          { label: "GCP Looker Utility", href: "/tools/gcp-looker-utility" },
          { label: "Convert PBIP to LookML" },
        ]}
      />
      <ConvertModule />
    </div>
  );
}
