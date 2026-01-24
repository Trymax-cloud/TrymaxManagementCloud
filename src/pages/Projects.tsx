import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects, Project, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { PROJECT_STAGES, type ProjectStage } from "@/constants/projectStages";
import { useAssignments } from "@/hooks/useAssignments";
import { useAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";
import { useUserRole } from "@/hooks/useUserRole";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectDetailModal } from "@/components/projects/ProjectDetailModal";
import { Plus, FolderKanban, Calendar, Search, Filter, ChevronDown, ChevronRight, Package, ClipboardCheck, Truck, CheckCircle, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STAGE_ICONS: Record<ProjectStage, React.ReactNode> = {
  order_received: <Package className="h-5 w-5" />,
  shipment_plan: <Calendar className="h-5 w-5" />,
  order_to_supplier: <Plus className="h-5 w-5" />,
  inspection: <ClipboardCheck className="h-5 w-5" />,
  dispatch: <Truck className="h-5 w-5" />,
  delivery: <CheckCircle className="h-5 w-5" />,
};

export default function Projects() {
  const { isDirector } = useUserRole();
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const { data: assignments } = useAssignmentsWithProfiles();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "stages">("stages");
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    order_received: true,
    inspection: true,
    dispatch: true,
    delivery: true,
  });

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getProjectProgress = (projectId: string) => {
    const projectAssignments = assignments?.filter(a => a.project_id === projectId) || [];
    const completed = projectAssignments.filter(a => a.status === "completed").length;
    const total = projectAssignments.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setDetailModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    navigate(`/projects/${project.id}/edit`);
  };

  const handleDeleteProject = (project: Project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const toggleStage = (stage: string) => {
    setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }));
  };

  const getProjectsByStage = (stage: ProjectStage) => {
    return filteredProjects?.filter(p => p.stage === stage) || [];
  };

  const renderProjectCard = (project: Project) => {
    const progress = getProjectProgress(project.id);
    return (
      <Card 
        key={project.id} 
        className="border-0 shadow-soft hover:shadow-medium transition-shadow relative group"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
              <CardDescription>{project.client_name}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={project.status} />
              {isDirector && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent 
          className="space-y-3 cursor-pointer"
          onClick={() => handleProjectClick(project)}
        >
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          )}
          
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(project.start_date), "MMM d, yyyy")}</span>
            </div>
            {project.end_date && (
              <div className="flex items-center gap-1">
                <span>→</span>
                <span>{format(new Date(project.end_date), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout title="Projects">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Manage and track all your projects
          </p>
          <div className="flex gap-2">
            <Select value={viewMode} onValueChange={(v: "grid" | "stages") => setViewMode(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stages">Stage View</SelectItem>
                <SelectItem value="grid">Grid View</SelectItem>
              </SelectContent>
            </Select>
            {isDirector && (
              <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects View */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !filteredProjects || filteredProjects.length === 0 ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FolderKanban className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {searchQuery || statusFilter !== "all" ? "No matching projects" : "No projects yet"}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {isDirector 
                  ? "Create your first project to start organizing work"
                  : "No projects have been assigned to you yet"}
              </p>
              {isDirector && !searchQuery && statusFilter === "all" && (
                <Button className="mt-4 gap-2" onClick={() => setCreateModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === "stages" ? (
          <div className="space-y-4">
            {PROJECT_STAGES.map((stage) => {
              const stageProjects = getProjectsByStage(stage.value);
              const isExpanded = expandedStages[stage.value];
              
              return (
                <Collapsible key={stage.value} open={isExpanded} onOpenChange={() => toggleStage(stage.value)}>
                  <Card className="border-0 shadow-soft">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              {STAGE_ICONS[stage.value]}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{stage.label}</CardTitle>
                              <CardDescription>{stageProjects.length} project{stageProjects.length !== 1 ? 's' : ''}</CardDescription>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {stageProjects.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No projects in this stage</p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {stageProjects.map(renderProjectCard)}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map(renderProjectCard)}
          </div>
        )}
      </div>

      <CreateProjectModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
      />
      
      <DeleteProjectDialog 
        open={deleteDialogOpen} 
        onOpenChange={setDeleteDialogOpen} 
        project={selectedProject}
      />
      
      <ProjectDetailModal
        project={selectedProject}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </AppLayout>
  );
}
