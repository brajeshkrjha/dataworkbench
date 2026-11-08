import { HomeHero } from "@/features/tools/components/home-hero";
import { HomeOverview } from "@/features/tools/components/home-overview";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <HomeHero />
      <HomeOverview />
    </div>
  );
}
