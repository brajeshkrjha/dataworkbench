import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { ServerStatusLoader } from "@/components/layout/server-status-loader";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <ServerStatusLoader />
      <Header />
      <div className="flex min-w-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-10">
          <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
