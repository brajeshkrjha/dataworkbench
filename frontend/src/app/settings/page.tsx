import { PageHeader } from "@/components/shared/page-header";
import { ThemeSettings } from "@/features/settings/components/theme-settings";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Manage your DataWorkbench preferences." />
      <div className="flex max-w-xl flex-col gap-4">
        <ThemeSettings />
      </div>
    </div>
  );
}
