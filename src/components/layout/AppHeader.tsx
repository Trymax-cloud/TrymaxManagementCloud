import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { NavLink } from "@/components/NavLink";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "Dashboard" }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const userName = user?.user_metadata?.name || user?.email || 'User';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden" />
      
      <div className="flex flex-1 items-center gap-4">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {title}
        </h1>
      </div>

      <div className="hidden md:flex md:flex-1 md:max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search assignments, projects..."
            className="w-full pl-10 bg-secondary border-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <NavLink 
                to="/profile" 
                className="w-full cursor-pointer"
                activeClassName="bg-accent"
              >
                Profile
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NavLink 
                to="/settings" 
                className="w-full cursor-pointer"
                activeClassName="bg-accent"
              >
                Settings
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
