import { useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyAssignments } from "@/hooks/useAssignments";
import { useMyAssignmentsWithProfiles } from "@/hooks/useAssignmentsWithProfiles";
import { useMyPayments } from "@/hooks/usePayments";
import { toast } from "@/hooks/use-toast";
import { differenceInDays, isToday, isTomorrow, parseISO } from "date-fns";

const REMINDER_CHECK_INTERVAL = 60000; // Check every minute
const SHOWN_REMINDERS_KEY = "shown_reminders";

interface ShownReminders {
  [key: string]: number; // timestamp of when shown
}

function getShownReminders(): ShownReminders {
  try {
    const stored = localStorage.getItem(SHOWN_REMINDERS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function markReminderShown(id: string) {
  const reminders = getShownReminders();
  reminders[id] = Date.now();
  // Clean up old reminders (older than 24 hours)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const cleaned = Object.fromEntries(
    Object.entries(reminders).filter(([, timestamp]) => timestamp > oneDayAgo)
  );
  localStorage.setItem(SHOWN_REMINDERS_KEY, JSON.stringify(cleaned));
}

function wasReminderShownRecently(id: string): boolean {
  const reminders = getShownReminders();
  const shownAt = reminders[id];
  if (!shownAt) return false;
  // Don't show again within 4 hours
  return Date.now() - shownAt < 4 * 60 * 60 * 1000;
}

export function useReminderCheck() {
  const { user } = useAuth();
  const { data: assignments } = useMyAssignmentsWithProfiles();
  const { data: payments } = useMyPayments();

  const checkReminders = useCallback(() => {
    if (!user) return;

    const now = new Date();

    // Check assignment reminders
    assignments?.forEach((assignment) => {
      if (assignment.status === "completed" || !assignment.due_date) return;

      const dueDate = parseISO(assignment.due_date);
      const reminderId = `assignment-${assignment.id}`;

      if (wasReminderShownRecently(reminderId)) return;

      // Emergency assignments - always remind
      if (assignment.priority === "emergency") {
        toast({
          title: "🚨 Emergency Assignment",
          description: `"${assignment.title}" requires immediate attention!`,
          variant: "destructive",
        });
        markReminderShown(reminderId);
        return;
      }

      // Due today
      if (isToday(dueDate)) {
        toast({
          title: "⏰ Due Today",
          description: `"${assignment.title}" is due today!`,
          variant: "destructive",
        });
        markReminderShown(reminderId);
        return;
      }

      // Due tomorrow
      if (isTomorrow(dueDate)) {
        toast({
          title: "📅 Due Tomorrow",
          description: `"${assignment.title}" is due tomorrow`,
        });
        markReminderShown(reminderId);
        return;
      }

      // Overdue
      if (dueDate < now) {
        toast({
          title: "❗ Overdue Assignment",
          description: `"${assignment.title}" is overdue!`,
          variant: "destructive",
        });
        markReminderShown(reminderId);
      }
    });

    // Check payment reminders
    payments?.forEach((payment) => {
      if (payment.status === "paid") return;

      const dueDate = parseISO(payment.due_date);
      const reminderId = `payment-${payment.id}`;

      if (wasReminderShownRecently(reminderId)) return;

      const daysUntilDue = differenceInDays(dueDate, now);

      // Due within 3 days
      if (daysUntilDue <= 3 && daysUntilDue >= 0) {
        toast({
          title: "💰 Payment Reminder",
          description: `Payment from ${payment.client_name} is due ${
            daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}`
          }`,
          variant: daysUntilDue === 0 ? "destructive" : "default",
        });
        markReminderShown(reminderId);
        return;
      }

      // Overdue
      if (daysUntilDue < 0) {
        toast({
          title: "⚠️ Overdue Payment",
          description: `Payment from ${payment.client_name} is ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) > 1 ? "s" : ""} overdue`,
          variant: "destructive",
        });
        markReminderShown(reminderId);
      }
    });
  }, [user, assignments, payments]);

  useEffect(() => {
    if (!user) return;

    // Initial check after a short delay to let data load
    const initialTimeout = setTimeout(checkReminders, 3000);

    // Set up interval for periodic checks
    const interval = setInterval(checkReminders, REMINDER_CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [user, checkReminders]);
}
