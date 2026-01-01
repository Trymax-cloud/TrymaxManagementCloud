import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { format } from "date-fns";

// Start time tracking for an assignment
export function useStartTimeTracking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("assignments")
        .update({
          start_time: now,
          status: "in_progress",
        })
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Timer Started",
        description: `Started tracking at ${format(new Date(), "hh:mm a")}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Timer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Stop time tracking for an assignment
export function useStopTimeTracking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentId,
      startTime,
    }: {
      assignmentId: string;
      startTime: string;
    }) => {
      const now = new Date();
      const start = new Date(startTime);
      const durationMinutes = Math.round(
        (now.getTime() - start.getTime()) / (1000 * 60)
      );

      // Get current total duration to add to it
      const { data: current, error: fetchError } = await supabase
        .from("assignments")
        .select("total_duration_minutes")
        .eq("id", assignmentId)
        .single();

      if (fetchError) throw fetchError;

      const newTotalDuration =
        (current?.total_duration_minutes || 0) + durationMinutes;

      const { data, error } = await supabase
        .from("assignments")
        .update({
          end_time: now.toISOString(),
          total_duration_minutes: newTotalDuration,
        })
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, sessionDuration: durationMinutes };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      const hours = Math.floor(data.sessionDuration / 60);
      const minutes = data.sessionDuration % 60;
      toast({
        title: "Timer Stopped",
        description: `Session: ${hours > 0 ? `${hours}h ` : ""}${minutes}m`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Stop Timer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Reset time tracking for an assignment
export function useResetTimeTracking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await supabase
        .from("assignments")
        .update({
          start_time: null,
          end_time: null,
        })
        .eq("id", assignmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast({
        title: "Timer Reset",
        description: "Time tracking has been reset for this session.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Reset Timer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Format duration for display
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
