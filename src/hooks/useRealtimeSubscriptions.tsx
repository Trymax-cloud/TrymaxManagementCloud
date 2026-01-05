import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { notificationManager } from "@/utils/notificationManager";

type RealtimePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T;
};

export function useRealtimeAssignments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up assignments realtime subscription for user:", user.id);

    const channel = supabase
      .channel("assignments-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
        },
        (payload) => {
          console.log("Assignment change received:", payload);
          
          // Targeted invalidation instead of global invalidation
          // Only invalidate the most relevant queries
          queryClient.invalidateQueries({ queryKey: ["assignments"] });
          queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
          
          // Only invalidate profile queries if assignment assignee changed
          if (payload.eventType === "UPDATE" && 
              payload.old?.assignee_id !== payload.new?.assignee_id) {
            queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
            queryClient.invalidateQueries({ queryKey: ["my-assignments-with-profiles"] });
          }
          
          // Only invalidate stats if assignment status changed
          if (payload.eventType === "UPDATE" && 
              payload.old?.status !== payload.new?.status) {
            queryClient.invalidateQueries({ queryKey: ["assignment-stats"] });
            queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });
            queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
          }

          // Show toast for relevant updates
          if (payload.eventType === "INSERT") {
            const newAssignment = payload.new as { assignee_id: string; title: string; priority: string };
            console.log("New assignment created:", newAssignment);
            if (newAssignment.assignee_id === user.id) {
              toast({
                title: "New Assignment",
                description: newAssignment.title,
              });
              
              // Queue desktop notification
              notificationManager.addNotificationEvent({
                type: 'new-assignment',
                data: {
                  id: payload.new.id,
                  title: newAssignment.title,
                  priority: newAssignment.priority,
                  assignee_id: newAssignment.assignee_id,
                },
                timestamp: Date.now(),
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as { assignee_id: string; status: string; title: string; due_date: string; priority: string; };
            console.log("Assignment updated:", updated);
            if (updated.assignee_id === user.id && updated.status === "completed") {
              notificationManager.addNotificationEvent({
                type: 'task-completed',
                data: { id: payload.new.id, title: updated.title, priority: updated.priority, assignee_id: updated.assignee_id },
                timestamp: Date.now(),
              });
            }
            if (updated.assignee_id === user.id && updated.status !== "completed" && updated.due_date) {
              const dueDate = new Date(updated.due_date);
              const now = new Date();
              if (dueDate < now) {
                notificationManager.addNotificationEvent({
                  type: 'task-overdue',
                  data: { id: payload.new.id, title: updated.title, priority: updated.priority, assignee_id: updated.assignee_id },
                  timestamp: Date.now(),
                });
              }
            }
          } else if (payload.eventType === "DELETE") {
            console.log("Assignment deleted:", payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log("Assignment subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("Successfully subscribed to assignments changes");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("Failed to subscribe to assignments changes");
        }
      });

    return () => {
      console.log("Cleaning up assignments realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, toast]);
}

export function useRealtimeProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up projects realtime subscription for user:", user.id);

    const channel = supabase
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
        },
        (payload) => {
          console.log("Project change received:", payload);
          
          // Invalidate all project-related queries for comprehensive refresh
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["active-projects"] });
          queryClient.invalidateQueries({ queryKey: ["project-analytics"] });
          queryClient.invalidateQueries({ queryKey: ["project-with-profiles"] });
          queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });

          if (payload.eventType === "INSERT") {
            const project = payload.new as { name: string };
            console.log("New project created:", project);
            toast({
              title: "New Project Created",
              description: `Project "${project.name}" has been created`,
            });
          } else if (payload.eventType === "UPDATE") {
            console.log("Project updated:", payload.new);
          } else if (payload.eventType === "DELETE") {
            console.log("Project deleted:", payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log("Project subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("Successfully subscribed to projects changes");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("Failed to subscribe to projects changes");
        }
      });

    return () => {
      console.log("Cleaning up projects realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

export function useRealtimePayments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up payments realtime subscription for user:", user.id);

    const channel = supabase
      .channel("payments-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_payments",
        },
        (payload) => {
          console.log("Payment change received:", payload);
          
          // Invalidate all payment-related queries for comprehensive refresh
          queryClient.invalidateQueries({ queryKey: ["client_payments"] });
          queryClient.invalidateQueries({ queryKey: ["payments"] });
          queryClient.invalidateQueries({ queryKey: ["my-payments"] });
          queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
          queryClient.invalidateQueries({ queryKey: ["payment-analytics"] });
          queryClient.invalidateQueries({ queryKey: ["payment-trends"] });
          queryClient.invalidateQueries({ queryKey: ["client-payment-summaries"] });
          queryClient.invalidateQueries({ queryKey: ["upcoming-payment-reminders"] });
          queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });

          if (payload.eventType === "INSERT") {
            const payment = payload.new as { 
              client_name: string; 
              responsible_user_id: string;
            };
            console.log("New payment created:", payment);
            toast({
              title: "New Payment Added",
              description: `Payment for ${payment.client_name} has been added`,
            });
          } else if (payload.eventType === "UPDATE") {
            const payment = payload.new as { 
              responsible_user_id: string; 
              client_name: string; 
              status: string 
            };
            console.log("Payment updated:", payment);
            if (payment.responsible_user_id === user.id && payment.status === "paid") {
              toast({
                title: "Payment Received",
                description: `Payment from ${payment.client_name} marked as paid`,
              });
            }
          } else if (payload.eventType === "DELETE") {
            console.log("Payment deleted:", payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log("Payment subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("Successfully subscribed to payments changes");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("Failed to subscribe to payments changes");
        }
      });

    return () => {
      console.log("Cleaning up payments realtime subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

export function useRealtimeRatings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("ratings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_ratings",
        },
        (payload) => {
          console.log("Rating change:", payload);
          
          // Invalidate all rating-related queries for comprehensive refresh
          queryClient.invalidateQueries({ queryKey: ["ratings"] });
          queryClient.invalidateQueries({ queryKey: ["my-ratings"] });
          queryClient.invalidateQueries({ queryKey: ["rating-analytics"] });
          queryClient.invalidateQueries({ queryKey: ["employee-ratings"] });
          queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });

          if (payload.eventType === "INSERT") {
            const rating = payload.new as { user_id: string };
            if (rating.user_id === user.id) {
              toast({
                title: "New Rating",
                description: "You have received a new performance rating",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

export function useRealtimeMeetings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("meetings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
        },
        (payload) => {
          console.log("Meeting change:", payload);
          
          // Invalidate all meeting-related queries
          queryClient.invalidateQueries({ queryKey: ["meetings"] });
          queryClient.invalidateQueries({ queryKey: ["my-meetings"] });
          queryClient.invalidateQueries({ queryKey: ["upcoming-meetings"] });
          queryClient.invalidateQueries({ queryKey: ["meeting-participants"] });
          queryClient.invalidateQueries({ queryKey: ["daily-summary"] });

          if (payload.eventType === "INSERT") {
            const meeting = payload.new as { title: string; meeting_date: string };
            toast({
              title: "New Meeting Scheduled",
              description: `Meeting "${meeting.title}" scheduled for ${new Date(meeting.meeting_date).toLocaleDateString()}`,
            });
            
            // Check if current user is a participant
            // This would require checking meeting_participants table
            notificationManager.addNotificationEvent({
              type: 'new-meeting',
              data: {
                id: payload.new.id,
                title: meeting.title,
                date: meeting.meeting_date,
              },
              timestamp: Date.now(),
            });
          } else if (payload.eventType === "UPDATE") {
            const meeting = payload.new as { title: string; meeting_date: string; meeting_time: string };
            if (payload.old?.meeting_date !== meeting.meeting_date || payload.old?.meeting_time !== meeting.meeting_time) {
              toast({
                title: "Meeting Rescheduled",
                description: `Meeting "${meeting.title}" has been rescheduled`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

export function useRealtimeDailySummaries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("daily-summaries-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_summaries",
        },
        (payload) => {
          console.log("Daily Summary change:", payload);
          
          // Invalidate daily summary related queries
          queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
          queryClient.invalidateQueries({ queryKey: ["daily-summaries"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });

          if (payload.eventType === "INSERT") {
            const summary = payload.new as { created_date: string; created_by: string };
            if (summary.created_by === user.id) {
              toast({
                title: "Daily Summary Created",
                description: `Daily summary for ${new Date(summary.created_date).toLocaleDateString()} has been created`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

// Combined hook for all real-time subscriptions
export function useAllRealtimeSubscriptions() {
  useRealtimeAssignments();
  useRealtimeProjects();
  useRealtimePayments();
  useRealtimeRatings();
  useRealtimeMeetings();
  useRealtimeDailySummaries();
}
