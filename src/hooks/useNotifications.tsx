import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { desktopNotify } from "@/utils/desktopNotify";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  is_read: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  created_at: string;
  updated_at: string;
}

// Map notification types to settings keys
const notificationTypeToSettingsKey: Record<string, string> = {
  assignment_created: "assignmentReminders",
  assignment: "assignmentReminders",
  reminder: "assignmentReminders",
  success: "general",
  info: "general",
  general: "general",
  message_received: "messageNotifications",
  rating_received: "ratingNotifications",
  payment_created: "paymentNotifications",
  payment_reminder: "paymentReminders",
  payment_due: "paymentReminders",
  payment_overdue: "paymentReminders",
  meeting_created: "meetingNotifications",
  meeting_updated: "meetingNotifications",
  meeting_reminder: "meetingReminders",
  daily_summary: "dailySummary",
};

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { shouldShowNotification } = useSettings();

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔔 NEW NOTIFICATION RECEIVED:", payload.new);
          const notification = payload.new as Notification;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          
          // Check if this notification type is enabled in settings
          const settingsKey = notificationTypeToSettingsKey[notification.type];
          const shouldShow = settingsKey ? shouldShowNotification(settingsKey as any) : true;
          
          if (shouldShow) {
            console.log("🔔 SHOWING NOTIFICATION:", notification);
            
            // Show toast for new notifications
            toast({
              title: notification.title,
              description: notification.message,
              variant: notification.priority === "high" ? "destructive" : "default",
            });

            // Show desktop notification
            desktopNotify(notification.title, notification.message, notification.action_url, {
              tag: notification.id,
              silent: false,
              urgency: notification.priority === 'high' ? 'critical' : 'normal'
            });
          } else {
            console.log("🔔 NOTIFICATION BLOCKED BY SETTINGS");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, shouldShowNotification]);

  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log("🔔 FETCHING NOTIFICATIONS FOR USER:", user.id);
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("🔔 ERROR FETCHING NOTIFICATIONS:", error);
        throw error;
      }
      
      console.log("🔔 FETCHED NOTIFICATIONS COUNT:", data?.length || 0);
      if (data && data.length > 0) {
        console.log("🔔 SAMPLE NOTIFICATION:", data[0]);
      }
      
      return data as Notification[];
    },
    enabled: !!user?.id,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", "unread-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "All notifications marked as read" });
    },
  });
}

export function useClearAllNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "All notifications cleared" });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
