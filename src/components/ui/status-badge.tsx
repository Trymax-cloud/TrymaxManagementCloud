import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AssignmentStatus, AssignmentPriority, PaymentStatus, ProjectStatus } from "@/types";

interface StatusBadgeProps {
  status: AssignmentStatus | PaymentStatus | ProjectStatus;
  className?: string;
}

interface PriorityBadgeProps {
  priority: AssignmentPriority;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Assignment statuses
  not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-info/10 text-info border-info/20" },
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  on_hold: { label: "On Hold", className: "bg-warning/10 text-warning border-warning/20" },
  
  // Payment statuses
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  partially_paid: { label: "Partially Paid", className: "bg-info/10 text-info border-info/20" },
  paid: { label: "Paid", className: "bg-success/10 text-success border-success/20" },
  
  // Project statuses
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const priorityConfig: Record<AssignmentPriority, { label: string; className: string }> = {
  normal: { label: "Normal", className: "bg-muted text-muted-foreground" },
  high: { label: "High", className: "bg-warning/10 text-warning border-warning/20" },
  emergency: { label: "Emergency", className: "bg-emergency/10 text-emergency border-emergency/20 animate-pulse" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
