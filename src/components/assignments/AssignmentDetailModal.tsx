import { useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  User,
  FolderKanban,
  MessageSquare,
  History,
  Paperclip,
  Trash2,
  Tag,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateAssignment, useDeleteAssignment, type Assignment } from "@/hooks/useAssignments";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { TASK_CATEGORIES, type TaskCategory } from "@/lib/constants";

interface AssignmentDetailModalProps {
  assignment: Assignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentDetailModal({
  assignment,
  open,
  onOpenChange,
}: AssignmentDetailModalProps) {
  const { isDirector } = useUserRole();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const [newRemark, setNewRemark] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const handleDelete = async () => {
    try {
      await deleteAssignment.mutateAsync(assignment.id);
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const creatorName = assignment.creator?.name || "Unknown";
  const assigneeName = assignment.assignee?.name || "Unknown";
  const assigneeInitials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) setNewRemark(""); onOpenChange(isOpen); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto transition-all duration-200">
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
                  <PriorityBadge priority={assignment.priority} />
                  <StatusBadge status={assignment.status} />
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

            {/* Placeholder sections */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <History className="h-4 w-4" />
                <span className="text-sm">Status History</span>
                <Badge variant="secondary" className="ml-auto">
                  Coming Soon
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                <span className="text-sm">Attachments</span>
                <Badge variant="secondary" className="ml-auto">
                  Coming Soon
                </Badge>
              </div>
            </div>

            {/* Actions */}
            {isDirector && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this assignment? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAssignment.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
