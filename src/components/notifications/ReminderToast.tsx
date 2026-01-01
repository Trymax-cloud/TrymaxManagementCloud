import { useEffect, useState } from "react";
import { Bell, X, Clock, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ReminderToastProps {
  id: string;
  type: "assignment" | "payment" | "project";
  title: string;
  message: string;
  priority?: "normal" | "high" | "emergency";
  onDismiss: (id: string) => void;
  onSnooze?: (id: string) => void;
  onAction?: () => void;
  actionLabel?: string;
}

export function ReminderToast({
  id,
  type,
  title,
  message,
  priority = "normal",
  onDismiss,
  onSnooze,
  onAction,
  actionLabel = "View",
}: ReminderToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss(id);
    }, 300);
  };

  const handleSnooze = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onSnooze?.(id);
    }, 300);
  };

  const Icon = type === "payment" ? CreditCard : type === "assignment" ? Clock : AlertTriangle;

  if (!isVisible) return null;

  return (
    <Card
      className={cn(
        "relative flex items-start gap-3 p-4 shadow-lg border transition-all duration-300",
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0",
        priority === "emergency" && "border-destructive bg-destructive/5",
        priority === "high" && "border-warning bg-warning/5"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          priority === "emergency" && "bg-destructive/10 text-destructive",
          priority === "high" && "bg-warning/10 text-warning",
          priority === "normal" && "bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        
        <div className="flex gap-2 pt-2">
          {onAction && (
            <Button size="sm" variant="default" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {onSnooze && (
            <Button size="sm" variant="outline" onClick={handleSnooze}>
              Snooze (1h)
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
