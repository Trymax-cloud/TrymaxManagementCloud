import { 
  LayoutDashboard, 
  ClipboardList, 
  FolderKanban, 
  Star, 
  CreditCard, 
  Bell, 
  Settings,
  Users,
  FileText,
  LogOut,
  MessageSquare,
  CalendarDays,
  BarChart3
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const employeeMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Assignments", url: "/assignments", icon: ClipboardList },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "My Ratings", url: "/ratings", icon: Star },
  { title: "Daily Summary", url: "/daily-summary", icon: FileText },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Meetings", url: "/meetings", icon: CalendarDays },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const directorMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "All Assignments", url: "/assignments", icon: ClipboardList },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Employee Ratings", url: "/ratings", icon: Star },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Daily Reports", url: "/daily-summary", icon: FileText },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Meetings", url: "/meetings", icon: CalendarDays },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, userRole, signOut } = useAuth();
  const collapsed = state === "collapsed";
  
  const menuItems = userRole === 'director' ? directorMenuItems : employeeMenuItems;
  const userName = user?.user_metadata?.name || user?.email || 'User';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            TF
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display font-semibold text-sidebar-foreground">
                TrymaxFurnace
              </span>
              <span className="text-xs text-sidebar-foreground/60 capitalize">
                {userRole || 'Employee'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings">
                  <NavLink 
                    to="/settings" 
                    className="flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {userName}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {user?.email}
              </span>
            </div>
          )}
          {!collapsed && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
