import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCatalog } from "@/features/tools/components/tool-catalog";
import { ToolGridSkeleton } from "@/features/tools/components/tool-grid-skeleton";

export default function ToolCatalogPage() {
  return (
    <div>
      <PageHeader
        title="Tools"
        description="Browse every tool available in DataWorkbench."
      />
      <Suspense fallback={<ToolGridSkeleton />}>
        <ToolCatalog />
      </Suspense>
    </div>
  );
}
