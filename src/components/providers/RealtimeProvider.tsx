import { useAllRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";
import { useReminderCheck } from "@/hooks/useReminderCheck";
import { useMeetingReminders } from "@/hooks/useMeetingReminders";

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  // Initialize all real-time subscriptions
  useAllRealtimeSubscriptions();
  
  // Initialize reminder checking system
  useReminderCheck();
  
  // Initialize meeting reminders
  useMeetingReminders();

  return <>{children}</>;
}
