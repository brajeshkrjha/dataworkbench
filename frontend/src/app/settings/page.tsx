import { PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/features/settings/components/settings-view";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Manage your DataWorkbench preferences." />
      <SettingsView />
    </div>
  );
}
