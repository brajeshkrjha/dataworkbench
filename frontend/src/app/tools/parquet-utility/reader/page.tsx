import { PageHeader } from "@/components/shared/page-header";
import { ReaderModule } from "@/features/parquet/modules/reader/reader-module";

export default function ReaderPage() {
  return (
    <div>
      <PageHeader
        title="Read Parquet"
        description="View parquet files directly in the browser."
        breadcrumbs={[
          { label: "Parquet Utility", href: "/tools/parquet-utility" },
          { label: "Read Parquet" },
        ]}
      />
      <ReaderModule />
    </div>
  );
}
