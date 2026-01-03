import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { type TaskCategory, DEFAULT_CATEGORY } from "@/lib/constants";
import {
  type AssignmentWithProfiles,
  type AssignmentFilters,
  type CreateAssignmentInput,
  type Assignment,
} from "@/types/assignment";

// Re-export Assignment type for backward compatibility
export type { Assignment } from "@/types/assignment";

/* ----------------------------------
   FETCH ASSIGNMENTS (FILTERED)
----------------------------------- */
export function useAssignments(filters: AssignmentFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assignments", filters],
    queryFn: async () => {
      // TEMPORARILY DISABLED TO PREVENT 400 ERRORS
      console.warn("⚠️ useAssignments is temporarily disabled - use useAssignmentsWithProfiles instead");
      return [];
    },
    enabled: !!user,
  });
}

/* ----------------------------------
   FETCH ALL ASSIGNMENTS (DIRECTOR)
----------------------------------- */
export function useAllAssignments() {
  const { user } = useAuth();

  return useQuery<AssignmentWithProfiles[]>({
    queryKey: ["all-assignments"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          `
          *,
          creator:profiles!assignments_creator_id_fkey (
            id,
            name,
            email,
            avatar_url,
            created_at,
            updated_at
          ),
          assignee:profiles!assignments_assignee_id_fkey (
            id,
            name,
            email,
            avatar_url,
            created_at,
            updated_at
          ),
          project:projects (
            id,
            name,
            client_name,
            created_at,
            created_by,
            description,
            start_date,
            end_date,
            stage,
            status,
            updated_at
          )
        `
        )
        .order("created_date", { ascending: false })
        .returns<AssignmentWithProfiles[]>();

      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ----------------------------------
   FETCH MY ASSIGNMENTS
----------------------------------- */
export function useMyAssignments(filters: AssignmentFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-assignments", user?.id, filters],
    queryFn: async () => {
      // TEMPORARILY DISABLED TO PREVENT 400 ERRORS
      console.warn("⚠️ useMyAssignments is temporarily disabled - use useMyAssignmentsWithProfiles instead");
      return [];
    },
    enabled: !!user,
  });
}

/* ----------------------------------
   FETCH SINGLE ASSIGNMENT
----------------------------------- */
export function useAssignment(id: string) {
  return useQuery<AssignmentWithProfiles>({
    queryKey: ["assignment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          `
          *,
          creator:profiles!assignments_creator_id_fkey (
            id,
            name,
            email,
            avatar_url,
            created_at,
            updated_at
          ),
          assignee:profiles!assignments_assignee_id_fkey (
            id,
            name,
            email,
            avatar_url,
            created_at,
            updated_at
          ),
          project:projects (
            id,
            name,
            client_name,
            created_at,
            created_by,
            description,
            start_date,
            end_date,
            stage,
            status,
            updated_at
          )
        `
        )
        .eq("id", id)
        .single()
        .returns<AssignmentWithProfiles>();

      if (error) throw error;
      return data;
    },
  });
}

/* ----------------------------------
   CREATE ASSIGNMENT
----------------------------------- */
export function useCreateAssignment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      if (!user) throw new Error("Not authenticated");

      const rows = input.assignee_ids.map((assignee_id) => ({
        title: input.title,
        description: input.description || null,
        assignee_id,
        project_id: input.project_id || null,
        due_date: input.due_date || null,
        priority: input.priority,
        category: input.category || DEFAULT_CATEGORY,
        remark: input.remark || null,
        creator_id: user.id,
      }));

      const { error } = await supabase.from("assignments").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate old hooks
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });
      
      // Invalidate new production-ready hooks
      queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments-with-profiles"] });
      
      toast({ title: "Assignment created successfully" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

/* ----------------------------------
   UPDATE ASSIGNMENT
----------------------------------- */
export function useUpdateAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      description?: string;
      due_date?: string;
      status?: string;
      remark?: string;
      category?: TaskCategory;
    }) => {
      const updateData: Record<string, unknown> = {};

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.due_date !== undefined) updateData.due_date = input.due_date;
      if (input.status) updateData.status = input.status;
      if (input.remark !== undefined) updateData.remark = input.remark;
      if (input.category) updateData.category = input.category;
      if (input.status === "completed") {
        updateData.completion_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from("assignments")
        .update(updateData)
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate old hooks
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });
      
      // Invalidate new production-ready hooks
      queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments-with-profiles"] });
      
      toast({ title: "Assignment updated" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

/* ----------------------------------
   DELETE ASSIGNMENT
----------------------------------- */
export function useDeleteAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("🗑️ Deleting assignment:", id);
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) {
        console.error("❌ Delete failed:", error);
        throw error;
      }
      console.log("✅ Assignment deleted successfully");
    },
    onSuccess: () => {
      // Invalidate old hooks
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });
      
      // Invalidate new production-ready hooks
      queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments-with-profiles"] });
      
      toast({ title: "Assignment deleted" });
    },
    onError: (error) => {
      console.error("❌ Delete mutation error:", error);
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: error.message || "Failed to delete assignment" 
      });
    },
  });
}

/* ----------------------------------
   ASSIGNMENT STATS
----------------------------------- */
export function useAssignmentStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assignment-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("assignments")
        .select("status, priority")
        .eq("assignee_id", user.id);

      if (error) throw error;

      return {
        total: data.length,
        completed: data.filter((a) => a.status === "completed").length,
        inProgress: data.filter((a) => a.status === "in_progress").length,
        pending: data.filter((a) => a.status === "not_started").length,
        emergency: data.filter((a) => a.priority === "emergency").length,
      };
    },
    enabled: !!user,
  });
}

/* ----------------------------------
   OVERDUE ASSIGNMENTS
----------------------------------- */
export function useOverdueAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["overdue-assignments", user?.id],
    queryFn: async () => {
      // TEMPORARILY DISABLED TO PREVENT 400 ERRORS
      console.warn("⚠️ useOverdueAssignments is temporarily disabled - use useOverdueAssignmentsWithProfiles instead");
      return [];
    },
    enabled: !!user,
  });
}

/* ----------------------------------
   OVERDUE ASSIGNMENTS WITH PROFILES
----------------------------------- */
export function useOverdueAssignmentsWithProfiles() {
  const { user } = useAuth();

  return useQuery<AssignmentWithProfiles[]>({
    queryKey: ["overdue-assignments-with-profiles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("assignments")
        .select(
          `
          *,
          creator:profiles!assignments_creator_id_fkey (
            id,
            name,
            email,
            avatar_url,
            created_at,
            updated_at
          ),
          assignee:profiles!assignments_assignee_id_fkey (
            id,
            name,
            email,
            avatar_url,
            created_at,
            updated_at
          ),
          project:projects (
            id,
            name,
            client_name,
            created_at,
            created_by,
            description,
            start_date,
            end_date,
            stage,
            status,
            updated_at
          )
        `
        )
        .eq("assignee_id", user.id)
        .neq("status", "completed")
        .lt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .returns<AssignmentWithProfiles[]>();

      if (error) throw error;
      return data ?? [];
    },
  });
}
