import { memo, useMemo } from "react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { Calendar, FolderKanban, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type AssignmentWithRelations } from "@/types/assignment-relations";
import { useDirectDeleteAssignment } from "@/hooks/useDirectDeleteAssignment";
import { useUserRole } from "@/hooks/useUserRole";

interface AssignmentCardProps {
  assignment: AssignmentWithRelations;
  onClick?: () => void;
  showAssignee?: boolean;
}

export const AssignmentCard = memo(function AssignmentCard({ 
  assignment, 
  onClick, 
  showAssignee = false 
}: AssignmentCardProps) {
  const { isDirector } = useUserRole();
  const deleteAssignment = useDirectDeleteAssignment();
  
  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && assignment.status !== "completed";
  const isDueToday = dueDate && isToday(dueDate);
  const isDueTomorrow = dueDate && isTomorrow(dueDate);

  const dueDateLabel = useMemo(() => {
    if (!dueDate) return "No due date";
    if (isOverdue) return `Overdue: ${format(dueDate, "MMM d")}`;
    if (isDueToday) return "Due today";
    if (isDueTomorrow) return "Due tomorrow";
    return format(dueDate, "MMM d, yyyy");
  }, [dueDate, isOverdue, isDueToday, isDueTomorrow]);

  const assigneeInitials = useMemo(() => {
    const name = assignment.assignee?.name || "Loading...";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }, [assignment.assignee?.name]);

  const assigneeName = assignment.assignee?.name || "Loading...";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click (modal opening)
    deleteAssignment.mutate(assignment.id);
  };

  return (
    <Card
      className={cn(
        "cursor-pointer border-0 shadow-soft transition-all hover:shadow-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isOverdue && "border-l-4 border-l-destructive",
        assignment.priority === "emergency" && "border-l-4 border-l-emergency"
      )}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      role="button"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-foreground line-clamp-2">{assignment.title}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <CategoryBadge category={assignment.category} />
            <PriorityBadge priority={assignment.priority as any} />
            {isDirector && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleteAssignment.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignment.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{assignment.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className={cn("flex items-center gap-1", isOverdue && "text-destructive")}>
            <Calendar className="h-3.5 w-3.5" />
            <span>{dueDateLabel}</span>
          </div>

          {assignment.project && (
            <div className="flex items-center gap-1">
              <FolderKanban className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px]">{assignment.project.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <StatusBadge status={assignment.status as any} />
          
          {showAssignee && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-muted">
                  {assigneeInitials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{assigneeName}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
