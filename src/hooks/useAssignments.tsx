import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { type TaskCategory, DEFAULT_CATEGORY } from "@/lib/constants";
import { 
  type AssignmentWithProfiles, 
  type Assignment, 
  type AssignmentFilters, 
  type CreateAssignmentInput,
  type Profile,
  type Project
} from "@/types/assignment";

export function useAssignments(filters: AssignmentFilters = {}): ReturnType<typeof useQuery<AssignmentWithProfiles[]>> {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assignments", filters],
    queryFn: async (): Promise<AssignmentWithProfiles[]> => {
      let query = supabase
        .from("assignments")
        .select(`
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
            end_date,
            start_date,
            stage,
            status,
            updated_at
          )
        `)
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
      return data as AssignmentWithProfiles[];
    },
    enabled: !!user,
  });
}

// Hook to fetch ALL assignments (for directors)
export function useAllAssignments(): ReturnType<typeof useQuery<AssignmentWithProfiles[]>> {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-assignments"],
    queryFn: async (): Promise<AssignmentWithProfiles[]> => {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
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
            end_date,
            start_date,
            stage,
            status,
            updated_at
          )
        `)
        .order("created_date", { ascending: false });

      if (error) throw error;
      return data as AssignmentWithProfiles[];
    },
    enabled: !!user,
  });
}

export function useMyAssignments(filters: AssignmentFilters = {}): ReturnType<typeof useQuery<AssignmentWithProfiles[]>> {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-assignments", user?.id, filters],
    queryFn: async (): Promise<AssignmentWithProfiles[]> => {
      if (!user) return [];

      let query = supabase
        .from("assignments")
        .select(`
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
            end_date,
            start_date,
            stage,
            status,
            updated_at
          )
        `)
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
      return data as AssignmentWithProfiles[];
    },
    enabled: !!user,
  });
}

export function useAssignment(id: string): ReturnType<typeof useQuery<AssignmentWithProfiles>> {
  return useQuery({
    queryKey: ["assignment", id],
    queryFn: async (): Promise<AssignmentWithProfiles> => {
      const { data, error } = await supabase
        .from("assignments")
        .select(`
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
            end_date,
            start_date,
            stage,
            status,
            updated_at
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as AssignmentWithProfiles;
    },
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      if (!user) throw new Error("Not authenticated");

      // Create an assignment for each assignee
      const assignments = input.assignee_ids.map((assignee_id) => ({
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

      const { data, error } = await supabase
        .from("assignments")
        .insert(assignments)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      const count = data?.length || 1;
      toast({ 
        title: "Assignment created", 
        description: count > 1 
          ? `${count} assignments have been created successfully.`
          : "The assignment has been created successfully." 
      });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useUpdateAssignment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; status?: string; remark?: string; category?: TaskCategory }) => {
      if (!user) throw new Error("Not authenticated");

      const updateData: Record<string, unknown> = {};
      if (input.status) updateData.status = input.status;
      if (input.remark) updateData.remark = input.remark;
      if (input.category) updateData.category = input.category;
      if (input.status === "completed") updateData.completion_date = new Date().toISOString();

      const { data, error } = await supabase
        .from("assignments")
        .update(updateData)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      toast({ title: "Assignment updated" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useDeleteAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      toast({ title: "Assignment deleted" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

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

export function useOverdueAssignments(): ReturnType<typeof useQuery<AssignmentWithProfiles[]>> {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["overdue-assignments", user?.id],
    queryFn: async (): Promise<AssignmentWithProfiles[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("assignments")
        .select(`
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
            end_date,
            start_date,
            stage,
            status,
            updated_at
          )
        `)
        .eq("assignee_id", user.id)
        .neq("status", "completed")
        .lt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as AssignmentWithProfiles[];
    },
    enabled: !!user,
  });
}
