import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { startOfDay, endOfDay, format } from "date-fns";
import type { Assignment } from "./useAssignments";

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  tasks_completed: number;
  tasks_pending: number;
  tasks_in_progress: number;
  emergency_tasks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailySummaryData {
  date: Date;
  tasksCompleted: number;
  tasksPending: number;
  tasksInProgress: number;
  emergencyTasks: number;
  completionRate: number;
  assignmentsDue: Assignment[];
  assignmentsCompleted: Assignment[];
}

// Hook to generate daily summary data from assignments
export function useDailySummaryData(date: Date, userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ["daily-summary-data", format(date, "yyyy-MM-dd"), targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const dateStart = startOfDay(date);
      const dateEnd = endOfDay(date);

      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("assignee_id", targetUserId);

      if (error) throw error;

      // Filter assignments due on this date
      const assignmentsDue = (assignments as Assignment[]).filter((a) => {
        if (!a.due_date) return false;
        const dueDate = new Date(a.due_date);
        return dueDate >= dateStart && dueDate <= dateEnd;
      });

      // Filter assignments completed on this date
      const assignmentsCompleted = (assignments as Assignment[]).filter((a) => {
        if (!a.completion_date) return false;
        const completionDate = new Date(a.completion_date);
        return completionDate >= dateStart && completionDate <= dateEnd;
      });

      const tasksCompleted = assignmentsCompleted.length;
      const tasksPending = assignmentsDue.filter((a) => a.status === "not_started").length;
      const tasksInProgress = assignmentsDue.filter((a) => a.status === "in_progress").length;
      const emergencyTasks = assignmentsDue.filter((a) => a.priority === "emergency").length;

      const totalDue = assignmentsDue.length;
      const completionRate = totalDue > 0 ? Math.round((tasksCompleted / totalDue) * 100) : 0;

      return {
        date,
        tasksCompleted,
        tasksPending,
        tasksInProgress,
        emergencyTasks,
        completionRate,
        assignmentsDue,
        assignmentsCompleted,
      } as DailySummaryData;
    },
    enabled: !!targetUserId,
  });
}

// Hook to fetch stored daily summaries
export function useDailySummaries(startDate: Date, endDate: Date, userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: [
      "daily-summaries",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      targetUserId,
    ],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
        .from("daily_summaries")
        .select("*")
        .eq("user_id", targetUserId)
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      if (error) throw error;
      return data as DailySummary[];
    },
    enabled: !!targetUserId,
    staleTime: 0, // Always fetch fresh data
  });
}

// Hook to save/update daily summary
export function useSaveDailySummary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date,
      notes,
      tasksCompleted,
      tasksPending,
      tasksInProgress,
      emergencyTasks,
    }: {
      date: Date;
      notes?: string;
      tasksCompleted: number;
      tasksPending: number;
      tasksInProgress: number;
      emergencyTasks: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const dateStr = format(date, "yyyy-MM-dd");

      // Check if summary exists for this date
      const { data: existing } = await supabase
        .from("daily_summaries")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", dateStr)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("daily_summaries")
          .update({
            tasks_completed: tasksCompleted,
            tasks_pending: tasksPending,
            tasks_in_progress: tasksInProgress,
            emergency_tasks: emergencyTasks,
            notes: notes || null,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("daily_summaries")
          .insert({
            user_id: user.id,
            date: dateStr,
            tasks_completed: tasksCompleted,
            tasks_pending: tasksPending,
            tasks_in_progress: tasksInProgress,
            emergency_tasks: emergencyTasks,
            notes: notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch all daily summaries queries
      queryClient.invalidateQueries({ queryKey: ["daily-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["all-employee-summaries"] });
      toast({
        title: "Summary saved",
        description: "Daily summary has been saved successfully.",
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

// Hook to get all employees' daily summaries (Director view)
export function useAllEmployeeDailySummaries(date: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-employee-summaries", format(date, "yyyy-MM-dd")],
    queryFn: async () => {
      const dateStr = format(date, "yyyy-MM-dd");
      console.log("🔍 DEBUG: Fetching all employee summaries for date:", dateStr);

      // Fetch all profiles with roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id, 
          name, 
          email,
          user_roles!inner(role)
        `);

      if (profilesError) throw profilesError;
      
      // Fetch all assignments for this date
      const { data: assignments, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*");

      if (assignmentsError) throw assignmentsError;

      // Fetch all daily summaries for this date (to get notes)
      const { data: dailySummaries, error: summariesError } = await supabase
        .from("daily_summaries")
        .select("*")
        .eq("date", dateStr);

      if (summariesError) throw summariesError;
      
      const dateStart = startOfDay(date);
      const dateEnd = endOfDay(date);

      // Generate summary for each employee
      const summaries = profiles.map((profile) => {
        const userAssignments = (assignments as Assignment[]).filter(
          (a) => a.assignee_id === profile.id
        );

        const assignmentsDue = userAssignments.filter((a) => {
          if (!a.due_date) return false;
          const dueDate = new Date(a.due_date);
          return dueDate >= dateStart && dueDate <= dateEnd;
        });

        const assignmentsCompleted = userAssignments.filter((a) => {
          if (!a.completion_date) return false;
          const completionDate = new Date(a.completion_date);
          return completionDate >= dateStart && completionDate <= dateEnd;
        });

        const assignmentsInProgress = assignmentsDue.filter((a) => a.status === "in_progress").length;
        const assignmentsPending = assignmentsDue.filter((a) => a.status === "not_started").length;
        const emergencyTasks = assignmentsDue.filter((a) => a.priority === "emergency").length;

        // Find the employee's saved notes for this date
        const employeeSummary = (dailySummaries as DailySummary[])?.find(
          (s) => s.user_id === profile.id
        );

        // Find the employee's profile with role
        const userProfile = profiles?.find(p => p.id === profile.id);
        const userRoles = (userProfile?.user_roles as any[]) || [];
        const userRole = userRoles.length > 0 ? userRoles[0].role : 'employee';

        return {
          userId: profile.id,
          userName: profile.name,
          userEmail: profile.email,
          userRole: userRole, // Add role information
          date,
          tasksCompleted: assignmentsCompleted.length,
          tasksDue: assignmentsDue.length,
          tasksInProgress: (assignmentsInProgress?.length || 0),
          tasksPending: (assignmentsPending?.length || 0),
          emergencyTasks: (emergencyTasks?.length || 0),
          completionRate:
            assignmentsDue.length > 0
              ? Math.round((assignmentsCompleted.length / assignmentsDue.length) * 100)
              : 0,
          notes: employeeSummary?.notes || null,
        };
      });

      // Sort by tasks completed descending
      return summaries.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
  });
}
