import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

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
          console.log("Assignment change:", payload);
          
          // Invalidate all assignment queries
          queryClient.invalidateQueries({ queryKey: ["assignments"] });
          queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
          queryClient.invalidateQueries({ queryKey: ["assignment-stats"] });
          queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });

          // Show toast for relevant updates
          if (payload.eventType === "INSERT") {
            const newAssignment = payload.new as { assignee_id: string; title: string; priority: string };
            if (newAssignment.assignee_id === user.id) {
              toast({
                title: "New Assignment",
                description: `You have been assigned: ${newAssignment.title}`,
                variant: newAssignment.priority === "emergency" ? "destructive" : "default",
              });
            }
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as { assignee_id: string; status: string; title: string };
            if (updated.assignee_id === user.id && updated.status === "completed") {
              toast({
                title: "Assignment Completed",
                description: `"${updated.title}" marked as completed`,
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

export function useRealtimeProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

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
          console.log("Project change:", payload);
          
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["active-projects"] });
          queryClient.invalidateQueries({ queryKey: ["project-analytics"] });

          if (payload.eventType === "INSERT") {
            const project = payload.new as { name: string };
            toast({
              title: "New Project Created",
              description: `Project "${project.name}" has been created`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

export function useRealtimePayments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

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
          console.log("Payment change:", payload);
          
          queryClient.invalidateQueries({ queryKey: ["payments"] });
          queryClient.invalidateQueries({ queryKey: ["my-payments"] });
          queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
          queryClient.invalidateQueries({ queryKey: ["payment-analytics"] });

          if (payload.eventType === "UPDATE") {
            const payment = payload.new as { 
              responsible_user_id: string; 
              client_name: string; 
              status: string 
            };
            if (payment.responsible_user_id === user.id && payment.status === "paid") {
              toast({
                title: "Payment Received",
                description: `Payment from ${payment.client_name} marked as paid`,
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
          
          queryClient.invalidateQueries({ queryKey: ["ratings"] });
          queryClient.invalidateQueries({ queryKey: ["my-ratings"] });
          queryClient.invalidateQueries({ queryKey: ["rating-analytics"] });

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

// Combined hook for all real-time subscriptions
export function useAllRealtimeSubscriptions() {
  useRealtimeAssignments();
  useRealtimeProjects();
  useRealtimePayments();
  useRealtimeRatings();
}
