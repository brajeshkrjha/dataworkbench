import { StaggerGroup, StaggerItem } from "@/components/motion/motion-primitives";
import { ToolCard } from "@/features/tools/components/tool-card";
import type { ToolMetadata } from "@/types/tool";

export function ToolGrid({ tools }: { tools: ToolMetadata[] }) {
  return (
    <StaggerGroup
      key={tools.map((tool) => tool.id).join(",")}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {tools.map((tool) => (
        <StaggerItem key={tool.id} className="h-full">
          <ToolCard tool={tool} />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
