import { LayoutDashboard, Database, ShoppingBag, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, end: true },
  { title: "My listings", url: "/dashboard/listings", icon: Database },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, user, signOut } = useAuth();

  const initials = (profile?.display_name || user?.email || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Database className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground">
              Uber4Data
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.display_name || user?.email}
              </p>
              {profile?.company && (
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {profile.company}
                </p>
              )}
            </div>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={signOut}
          >
            Sign out
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
