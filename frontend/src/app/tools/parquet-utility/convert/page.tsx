import { PageHeader } from "@/components/shared/page-header";
import { ConvertModule } from "@/features/parquet/modules/convert/convert-module";

export default function ConvertPage() {
  return (
    <div>
      <PageHeader
        title="Convert Files"
        description="Convert CSV, JSON, and future formats into Parquet."
        breadcrumbs={[
          { label: "Parquet Utility", href: "/tools/parquet-utility" },
          { label: "Convert Files" },
        ]}
      />
      <ConvertModule />
    </div>
  );
}
