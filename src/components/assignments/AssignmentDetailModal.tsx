import { useState, useEffect } from "react";
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
  
  // Add local state for optimistic updates
  const [localAssignment, setLocalAssignment] = useState<AssignmentWithRelations | null>(assignment);

  // Sync local state when prop changes (e.g., when modal opens with new assignment)
  useEffect(() => {
    setLocalAssignment(assignment);
  }, [assignment]);

  // Check if user can delete this assignment
  // Directors can delete any assignment
  // Regular users can delete assignments they created OR assignments assigned to them
  const canDelete = isDirector || 
    (user && (assignment?.creator_id === user.id || assignment?.assignee_id === user.id));

  if (!localAssignment) return null;

  const handleStatusChange = async (newStatus: string) => {
  // Optimistically update local state immediately
  setLocalAssignment(prev => prev ? { 
    ...prev, 
    status: newStatus as Assignment["status"],
    completion_date: newStatus === "completed" ? new Date().toISOString() : prev.completion_date
  } : prev);
  
  try {
    await updateAssignment.mutateAsync({
      id: localAssignment.id,
      status: newStatus as Assignment["status"],
      remark: newRemark || undefined,
    });
    setNewRemark("");
  } catch {
    // Rollback on error
    setLocalAssignment(assignment);
  }
};

  const handleDelete = () => {
    deleteAssignment.mutate(assignment.id, {
      onSuccess: () => {
        onOpenChange(false); // Close modal after successful deletion
      }
    });
  };

  const creatorName = localAssignment.creator?.name || "Loading...";
  const assigneeName = localAssignment.assignee?.name || "Loading...";
  const assigneeInitials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) setNewRemark(""); onOpenChange(isOpen); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <DialogTitle className="font-display text-xl pr-8">
                  {localAssignment.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Assignment details and status management
                </DialogDescription>
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={localAssignment.priority as AssignmentPriority} />
                  <StatusBadge status={localAssignment.status as AssignmentStatus} />
                  <CategoryBadge category={localAssignment.category} />
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Description</Label>
              {localAssignment.description ? (
                <p className="text-sm">{localAssignment.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided</p>
              )}
            </div>

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

                {localAssignment.project && (
                  <div className="flex items-center gap-2 text-sm">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Project:</span>
                    <span className="font-medium">{localAssignment.project.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(localAssignment.created_date), "PPP")}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Due:</span>
                  {localAssignment.due_date ? (
                    <span
                      className={cn(
                        new Date(localAssignment.due_date) < new Date() &&
                          localAssignment.status !== "completed" &&
                          "text-destructive font-medium"
                      )}
                    >
                      {format(new Date(localAssignment.due_date), "PPP")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">No due date</span>
                  )}
                </div>

                {localAssignment.completion_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="text-success">
                      {format(new Date(localAssignment.completion_date), "PPP")}
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
                    value={localAssignment.status}
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
                  value={localAssignment.category}
                  onValueChange={(value) => {
                    // Optimistically update local state
                    setLocalAssignment(prev => prev ? { ...prev, category: value as TaskCategory } : prev);
                    
                    updateAssignment.mutate({
                      id: localAssignment.id,
                      category: value as TaskCategory,
                    }, {
                      onError: () => {
                        // Rollback on error
                        setLocalAssignment(assignment);
                      }
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
                    id: localAssignment.id,
                    remark: newRemark,
                  })
                }
                disabled={!newRemark.trim() || updateAssignment.isPending}
              >
                Save Remark
              </Button>

              {localAssignment.remark && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium mb-1">Current Remark:</p>
                  <p className="text-sm text-muted-foreground">{localAssignment.remark}</p>
                </div>
              )}
            </div>

            <Separator />
          </div>
          
          {/* Delete button in modal footer */}
          {canDelete && (
            <div className="flex justify-end pt-4 border-t mt-4">
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
