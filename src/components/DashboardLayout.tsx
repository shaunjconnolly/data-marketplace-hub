import { Outlet } from "react-router-dom";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border bg-card/60 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="text-sm font-medium text-muted-foreground">
              Dashboard
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
