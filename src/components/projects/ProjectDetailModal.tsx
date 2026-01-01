import { useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Calendar, FolderKanban, Clock, ChevronRight, Package, ClipboardCheck, Truck, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAssignments } from "@/hooks/useAssignments";
import { Project, PROJECT_STAGES, ProjectStage, useUpdateProjectStage } from "@/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";

interface ProjectDetailModalProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGE_ICONS: Record<ProjectStage, React.ReactNode> = {
  order_received: <Package className="h-4 w-4" />,
  inspection: <ClipboardCheck className="h-4 w-4" />,
  dispatch: <Truck className="h-4 w-4" />,
  delivery: <CheckCircle className="h-4 w-4" />,
};

export function ProjectDetailModal({ project, open, onOpenChange }: ProjectDetailModalProps) {
  const { data: allAssignments } = useAssignments();
  const { isDirector } = useUserRole();
  const updateStageMutation = useUpdateProjectStage();
  
  const projectAssignments = useMemo(() => 
    project ? allAssignments?.filter(a => a.project_id === project.id) || [] : [],
    [allAssignments, project]
  );

  const { completedCount, totalCount, progress } = useMemo(() => {
    const completed = projectAssignments.filter(a => a.status === "completed").length;
    const total = projectAssignments.length;
    return {
      completedCount: completed,
      totalCount: total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [projectAssignments]);

  const { currentStageIndex, nextStage, prevStage } = useMemo(() => {
    if (!project) return { currentStageIndex: -1, nextStage: null, prevStage: null };
    const idx = PROJECT_STAGES.findIndex(s => s.value === project.stage);
    return {
      currentStageIndex: idx,
      nextStage: idx < PROJECT_STAGES.length - 1 ? PROJECT_STAGES[idx + 1] : null,
      prevStage: idx > 0 ? PROJECT_STAGES[idx - 1] : null
    };
  }, [project]);

  const handleStageChange = useCallback((newStage: ProjectStage) => {
    if (project) {
      updateStageMutation.mutate({ projectId: project.id, stage: newStage });
    }
  }, [project, updateStageMutation]);

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{project.name}</DialogTitle>
              <DialogDescription className="mt-1">{project.client_name}</DialogDescription>
            </div>
            <StatusBadge status={project.status} />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stage Progress */}
          <div>
            <h4 className="font-medium mb-3">Project Stage</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {PROJECT_STAGES.map((stage, index) => {
                const isActive = stage.value === project.stage;
                const isPast = index < currentStageIndex;
                return (
                  <div key={stage.value} className="flex items-center">
                    <div 
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        isActive 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : isPast 
                            ? "bg-muted text-muted-foreground border-muted"
                            : "bg-background border-border text-muted-foreground"
                      }`}
                    >
                      {STAGE_ICONS[stage.value]}
                      <span className="text-sm font-medium">{stage.label}</span>
                    </div>
                    {index < PROJECT_STAGES.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                    )}
                  </div>
                );
              })}
            </div>
            {isDirector && (
              <div className="flex gap-2 mt-3">
                {prevStage && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleStageChange(prevStage.value)}
                    disabled={updateStageMutation.isPending}
                  >
                    ← Back to {prevStage.label}
                  </Button>
                )}
                {nextStage && (
                  <Button 
                    size="sm" 
                    onClick={() => handleStageChange(nextStage.value)}
                    disabled={updateStageMutation.isPending}
                  >
                    Move to {nextStage.label} →
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Project Overview */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{format(new Date(project.start_date), "PPP")}</p>
              </div>
            </div>
            {project.end_date && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{format(new Date(project.end_date), "PPP")}</p>
                </div>
              </div>
            )}
          </div>

          {project.description && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-muted-foreground">{project.description}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Progress Tracking */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Task Progress</h4>
              <span className="text-sm text-muted-foreground">
                {completedCount} of {totalCount} tasks completed
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-right text-sm text-muted-foreground mt-1">{progress}%</p>
          </div>

          {/* Linked Assignments */}
          <div>
            <h4 className="font-medium mb-3">Linked Assignments</h4>
            {projectAssignments.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No assignments linked to this project</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {projectAssignments.slice(0, 5).map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {assignment.due_date 
                          ? format(new Date(assignment.due_date), "MMM d, yyyy")
                          : "No due date"}
                      </p>
                    </div>
                    <StatusBadge status={assignment.status} />
                  </div>
                ))}
                {projectAssignments.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    +{projectAssignments.length - 5} more assignments
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
