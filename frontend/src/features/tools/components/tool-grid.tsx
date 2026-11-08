import { ToolCard } from "@/features/tools/components/tool-card";
import type { ToolMetadata } from "@/types/tool";

export function ToolGrid({ tools }: { tools: ToolMetadata[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
