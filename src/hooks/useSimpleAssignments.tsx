import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { type TaskCategory, DEFAULT_CATEGORY } from "@/lib/constants";
import {
  type AssignmentFilters,
  type CreateAssignmentInput,
  type Assignment,
} from "@/types/assignment";

// Simple assignment type without complex joins
interface SimpleAssignment {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  assignee_id: string;
  project_id: string | null;
  created_date: string;
  due_date: string | null;
  completion_date: string | null;
  status: "not_started" | "in_progress" | "completed" | "on_hold";
  priority: "normal" | "high" | "emergency";
  category: TaskCategory;
  remark: string | null;
  created_at: string;
  updated_at: string;
  start_time: string | null;
  end_time: string | null;
  total_duration_minutes: number | null;
}

export function useSimpleAssignments(filters: AssignmentFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["simple-assignments", filters],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("assignments")
        .select("*")
        .order("created_date", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }
      if (filters.projectId) {
        query = query.eq("project_id", filters.projectId);
      }
      if (filters.assigneeId) {
        query = query.eq("assignee_id", filters.assigneeId);
      }
      if (filters.category && filters.category !== "all") {
        query = query.eq("category", filters.category);
      }
      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSimpleMyAssignments(filters: AssignmentFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["simple-my-assignments", user?.id, filters],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("assignments")
        .select("*")
        .eq("assignee_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}
