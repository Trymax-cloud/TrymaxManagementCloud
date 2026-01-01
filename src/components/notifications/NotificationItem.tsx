import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Trash2, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  assignment: Bell,
  reminder: AlertTriangle,
  success: CheckCircle,
  info: Info,
  general: Bell,
};

const priorityColors: Record<string, string> = {
  normal: "border-l-muted-foreground",
  high: "border-l-warning",
  critical: "border-l-destructive",
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || Bell;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-4 border-l-4 rounded-lg transition-all cursor-pointer hover:bg-muted/50",
        notification.is_read ? "bg-background opacity-70" : "bg-muted/30",
        priorityColors[notification.priority] || priorityColors.normal
      )}
      onClick={() => onClick?.(notification)}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          notification.priority === "critical"
            ? "bg-destructive/10 text-destructive"
            : notification.priority === "high"
            ? "bg-warning/10 text-warning"
            : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium truncate",
                !notification.is_read && "font-semibold"
              )}
            >
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notification.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary" />
      )}
    </div>
  );
}
