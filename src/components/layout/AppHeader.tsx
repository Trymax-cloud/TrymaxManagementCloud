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
import { useState, useEffect } from "react";
import { useAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";
import { useProjects } from "@/hooks/useProjects";
import { useNavigate } from "react-router-dom";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "Dashboard" }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: allAssignments } = useAssignmentsWithProfiles();
  const { data: projects } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const userName = user?.user_metadata?.name || user?.email || 'User';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Filter assignments and projects based on search
  const filteredAssignments = allAssignments?.filter(assignment =>
    assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assignment.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assignment.assignee?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredProjects = projects?.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const hasResults = searchQuery.length > 0 && (filteredAssignments.length > 0 || filteredProjects.length > 0);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(value.length > 0);
  };

  // Handle result clicks
  const handleAssignmentClick = (assignmentId: string) => {
    navigate(`/assignments?search=${encodeURIComponent(searchQuery)}`);
    setShowResults(false);
    setSearchQuery("");
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects?search=${encodeURIComponent(searchQuery)}`);
    setShowResults(false);
    setSearchQuery("");
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowResults(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden" />
      
      <div className="flex flex-1 items-center gap-4">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {title}
        </h1>
      </div>

      <div className="hidden md:flex md:flex-1 md:max-w-md relative">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search assignments, projects..."
            className="w-full pl-10 bg-secondary border-0"
            value={searchQuery}
            onChange={handleSearchChange}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        
        {/* Search Results Dropdown */}
        {showResults && hasResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {filteredAssignments.length > 0 && (
              <div className="p-2">
                <h4 className="text-sm font-semibold text-muted-foreground px-2 py-1">Assignments</h4>
                {filteredAssignments.slice(0, 5).map((assignment) => (
                  <div
                    key={assignment.id}
                    className="px-2 py-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => handleAssignmentClick(assignment.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {assignment.description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.assignee?.name || 'Unassigned'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        assignment.priority === 'emergency' 
                          ? 'bg-red-100 text-red-800'
                          : assignment.priority === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {assignment.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {filteredProjects.length > 0 && (
              <div className="p-2 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground px-2 py-1">Projects</h4>
                {filteredProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="px-2 py-2 hover:bg-accent rounded cursor-pointer"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{project.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {project.description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {project.client_name}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
            <DropdownMenuItem onClick={() => window.location.href = '/settings'} className="w-full cursor-pointer">
              Settings
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
