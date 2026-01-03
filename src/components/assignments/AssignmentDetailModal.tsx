import { useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  User,
  FolderKanban,
  MessageSquare,
  Tag,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useUpdateAssignment } from "@/hooks/useAssignments";
import { useDirectDeleteAssignment } from "@/hooks/useDirectDeleteAssignment";
import { supabase } from "@/integrations/supabase/client";
import { type AssignmentWithRelations } from "@/types/assignment-relations";
import type { Assignment } from "@/types/assignment";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { TASK_CATEGORIES, type TaskCategory } from "@/lib/constants";
import type { AssignmentPriority, AssignmentStatus } from "@/types";

// Declare window property for TypeScript
declare global {
  interface Window {
    __pendingDeleteAssignmentId?: string;
  }
}

interface AssignmentDetailModalProps {
  assignment: AssignmentWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentDetailModal({
  assignment,
  open,
  onOpenChange,
}: AssignmentDetailModalProps) {
  const { isDirector } = useUserRole();
  const { user } = useAuth();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDirectDeleteAssignment();
  const [newRemark, setNewRemark] = useState(assignment?.remark || "");

  // Check if user can delete this assignment
  const canDelete = isDirector || (user && assignment?.assignee_id === user.id);

  if (!assignment) return null;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateAssignment.mutateAsync({
        id: assignment.id,
        status: newStatus as Assignment["status"],
        remark: newRemark || undefined,
      });
      setNewRemark("");
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = () => {
    deleteAssignment.mutate(assignment.id, {
      onSuccess: () => {
        onOpenChange(false); // Close modal after successful deletion
      }
    });
  };

  const creatorName = assignment.creator?.name || "Loading...";
  const assigneeName = assignment.assignee?.name || "Loading...";
  const assigneeInitials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) setNewRemark(""); onOpenChange(isOpen); }}>
        <DialogContent className="relative max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <DialogTitle className="font-display text-xl pr-8">
                  {assignment.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Assignment details and status management
                </DialogDescription>
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={assignment.priority as AssignmentPriority} />
                  <StatusBadge status={assignment.status as AssignmentStatus} />
                  <CategoryBadge category={assignment.category} />
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Description */}
            {assignment.description && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm">{assignment.description}</p>
              </div>
            )}

            {/* Meta Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Assigned to:</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-xs">
                        {assigneeInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{assigneeName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created by:</span>
                  <span className="font-medium">{creatorName}</span>
                </div>

                {assignment.project && (
                  <div className="flex items-center gap-2 text-sm">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Project:</span>
                    <span className="font-medium">{assignment.project.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(assignment.created_date), "PPP")}</span>
                </div>

                {assignment.due_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Due:</span>
                    <span
                      className={cn(
                        new Date(assignment.due_date) < new Date() &&
                          assignment.status !== "completed" &&
                          "text-destructive font-medium"
                      )}
                    >
                      {format(new Date(assignment.due_date), "PPP")}
                    </span>
                  </div>
                )}

                {assignment.completion_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="text-success">
                      {format(new Date(assignment.completion_date), "PPP")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Status and Category Update Section */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Update Status</Label>
                <div className="flex gap-3">
                  <Select
                    value={assignment.status}
                    onValueChange={handleStatusChange}
                    disabled={updateAssignment.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  {updateAssignment.isPending && <LoadingSpinner size="sm" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  Category
                </Label>
                <Select
                  value={assignment.category}
                  onValueChange={(value) => {
                    updateAssignment.mutate({
                      id: assignment.id,
                      category: value as TaskCategory,
                    });
                  }}
                  disabled={updateAssignment.isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label>Add Remark</Label>
              </div>
              <Textarea
                placeholder="Add a note or update about this assignment..."
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                rows={3}
              />
              <Button
                size="sm"
                onClick={() =>
                  updateAssignment.mutate({
                    id: assignment.id,
                    remark: newRemark,
                  })
                }
                disabled={!newRemark.trim() || updateAssignment.isPending}
              >
                Save Remark
              </Button>

              {assignment.remark && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium mb-1">Current Remark:</p>
                  <p className="text-sm text-muted-foreground">{assignment.remark}</p>
                </div>
              )}
            </div>

            <Separator />
          </div>
          
          {/* Delete button in bottom right */}
          {canDelete && (
            <div className="absolute bottom-4 right-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteAssignment.isPending}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Assignment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
