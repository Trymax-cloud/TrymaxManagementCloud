import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import type { Assignment } from "./useAssignments";

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  not_started: ["in_progress", "on_hold"],
  in_progress: ["completed", "on_hold", "not_started"],
  on_hold: ["in_progress", "not_started"],
  completed: ["in_progress"], // Allow reopening
};

export interface StatusHistoryEntry {
  id: string;
  assignment_id: string;
  old_status: string;
  new_status: string;
  remark: string | null;
  changed_by: string;
  changed_at: string;
}

// Validate status transition
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const validTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

// Get available status transitions for a given status
export function getAvailableTransitions(currentStatus: string): string[] {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

// Hook to fetch assignment status history
export function useAssignmentHistory(assignmentId: string) {
  return useQuery({
    queryKey: ["assignment-history", assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_status_history")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data as StatusHistoryEntry[];
    },
    enabled: !!assignmentId,
  });
}

// Hook to update assignment status with validation
export function useUpdateAssignmentStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignment,
      newStatus,
      remark,
    }: {
      assignment: Assignment;
      newStatus: string;
      remark?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Validate transition
      if (!isValidStatusTransition(assignment.status, newStatus)) {
        throw new Error(
          `Invalid status transition from ${assignment.status} to ${newStatus}`
        );
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        remark: remark || assignment.remark,
      };

      // Auto-set completion date when completing
      if (newStatus === "completed") {
        updateData.completion_date = new Date().toISOString();
      } else if (assignment.status === "completed" && newStatus !== "completed") {
        // Clear completion date if reopening
        updateData.completion_date = null;
      }

      const { data, error } = await supabase
        .from("assignments")
        .update(updateData)
        .eq("id", assignment.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignment", variables.assignment.id] });
      queryClient.invalidateQueries({ queryKey: ["assignment-history", variables.assignment.id] });
      queryClient.invalidateQueries({ queryKey: ["assignment-stats"] });
      
      toast({
        title: "Status updated",
        description: `Assignment moved to ${variables.newStatus.replace("_", " ")}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

// Hook to get assignment analytics
export function useAssignmentAnalytics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assignment-analytics", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*");

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Calculate metrics
      const total = assignments.length;
      const completed = assignments.filter((a) => a.status === "completed").length;
      const overdue = assignments.filter(
        (a) => a.due_date && new Date(a.due_date) < now && a.status !== "completed"
      ).length;
      const emergency = assignments.filter((a) => a.priority === "emergency").length;

      // Recent completions
      const recentCompletions = assignments.filter(
        (a) =>
          a.completion_date &&
          new Date(a.completion_date) >= thirtyDaysAgo &&
          a.status === "completed"
      ).length;

      // Completion rate (last 30 days)
      const recentAssignments = assignments.filter(
        (a) => new Date(a.created_date) >= thirtyDaysAgo
      );
      const completionRate =
        recentAssignments.length > 0
          ? Math.round(
              (recentAssignments.filter((a) => a.status === "completed").length /
                recentAssignments.length) *
                100
            )
          : 0;

      // Average completion time (in days)
      const completedWithDates = assignments.filter(
        (a) => a.status === "completed" && a.completion_date && a.created_date
      );
      const avgCompletionTime =
        completedWithDates.length > 0
          ? Math.round(
              completedWithDates.reduce((sum, a) => {
                const created = new Date(a.created_date).getTime();
                const completed = new Date(a.completion_date!).getTime();
                return sum + (completed - created) / (1000 * 60 * 60 * 24);
              }, 0) / completedWithDates.length
            )
          : 0;

      // Weekly trend
      const weeklyCompletions = assignments.filter(
        (a) => a.completion_date && new Date(a.completion_date) >= sevenDaysAgo
      ).length;

      return {
        total,
        completed,
        overdue,
        emergency,
        recentCompletions,
        completionRate,
        avgCompletionTime,
        weeklyCompletions,
        inProgress: assignments.filter((a) => a.status === "in_progress").length,
        pending: assignments.filter((a) => a.status === "not_started").length,
        onHold: assignments.filter((a) => a.status === "on_hold").length,
      };
    },
    enabled: !!user,
  });
}

// Hook to get emergency assignments requiring attention
export function useEmergencyAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["emergency-assignments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("priority", "emergency")
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!user,
  });
}
