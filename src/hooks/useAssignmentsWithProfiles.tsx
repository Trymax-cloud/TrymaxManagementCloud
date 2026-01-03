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
import { type AssignmentWithRelations } from "@/types/assignment-relations";

// Enhanced assignment hook with separate profile lookups
export function useAssignmentsWithProfiles(filters: AssignmentFilters = {}) {
  const { user } = useAuth();

  return useQuery<AssignmentWithRelations[]>({
    queryKey: ["assignments-with-profiles", filters],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Retry on network errors but not on validation errors
      if (error?.message?.includes('Invalid') || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      // Step 1: Fetch assignments
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

      const { data: assignments, error: assignmentsError } = await query;
      if (assignmentsError) throw assignmentsError;
      if (!assignments || assignments.length === 0) return [];

      // Step 2: Extract unique user IDs
      const userIds = new Set<string>();
      assignments.forEach(assignment => {
        userIds.add(assignment.creator_id);
        userIds.add(assignment.assignee_id);
      });

      // Step 3: Fetch all profiles in one query
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url, created_at, updated_at")
        .in("id", Array.from(userIds));

      if (profilesError) throw profilesError;

      // Step 4: Create profile lookup map
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Step 5: Combine assignments with profiles
      const assignmentsWithProfiles: AssignmentWithRelations[] = assignments.map(assignment => {
        const creatorProfile = profileMap.get(assignment.creator_id);
        const assigneeProfile = profileMap.get(assignment.assignee_id);
        
        return {
          ...assignment,
          // Cast all fields to the correct types
          status: assignment.status as "not_started" | "in_progress" | "completed" | "on_hold",
          priority: assignment.priority as "normal" | "high" | "emergency",
          category: assignment.category as "general" | "inspection" | "production" | "delivery" | "admin" | "other",
          creator: creatorProfile ? { name: creatorProfile.name, email: creatorProfile.email } : null,
          assignee: assigneeProfile ? { name: assigneeProfile.name, email: assigneeProfile.email } : null,
          project: null, // TODO: Add project lookup if needed
        };
      });

      return assignmentsWithProfiles;
    },
  });
}

export function useMyAssignmentsWithProfiles(filters: AssignmentFilters = {}) {
  const { user } = useAuth();

  return useQuery<AssignmentWithRelations[]>({
    queryKey: ["my-assignments-with-profiles", user?.id, filters],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Retry on network errors but not on validation errors
      if (error?.message?.includes('Invalid') || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      if (!user) return [];

      // Step 1: Fetch my assignments
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

      const { data: assignments, error: assignmentsError } = await query;
      if (assignmentsError) throw assignmentsError;
      if (!assignments || assignments.length === 0) return [];

      // Step 2: Extract unique user IDs
      const userIds = new Set<string>();
      assignments.forEach(assignment => {
        userIds.add(assignment.creator_id);
        userIds.add(assignment.assignee_id);
      });

      // Step 3: Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url, created_at, updated_at")
        .in("id", Array.from(userIds));

      if (profilesError) throw profilesError;

      // Step 4: Create profile lookup map
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Step 5: Combine assignments with profiles
      const assignmentsWithProfiles: AssignmentWithRelations[] = assignments.map(assignment => {
        const creatorProfile = profileMap.get(assignment.creator_id);
        const assigneeProfile = profileMap.get(assignment.assignee_id);
        
        return {
          ...assignment,
          // Cast all fields to the correct types
          status: assignment.status as "not_started" | "in_progress" | "completed" | "on_hold",
          priority: assignment.priority as "normal" | "high" | "emergency",
          category: assignment.category as "general" | "inspection" | "production" | "delivery" | "admin" | "other",
          creator: creatorProfile ? { name: creatorProfile.name, email: creatorProfile.email } : null,
          assignee: assigneeProfile ? { name: assigneeProfile.name, email: assigneeProfile.email } : null,
          project: null,
        };
      });

      return assignmentsWithProfiles;
    },
  });
}

// Enhanced assignment detail hook
export function useAssignmentWithProfiles(id: string) {
  const { user } = useAuth();

  return useQuery<AssignmentWithRelations>({
    queryKey: ["assignment-with-profiles", id],
    enabled: !!user && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Retry on network errors but not on validation errors
      if (error?.message?.includes('Invalid') || error?.message?.includes('Unauthorized') || error?.message?.includes('not found')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      if (!user || !id) return null;

      // Step 1: Fetch assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", id)
        .single();

      if (assignmentError) throw assignmentError;
      if (!assignment) return null;

      // Step 2: Fetch profiles
      const userIds = [assignment.creator_id, assignment.assignee_id];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url, created_at, updated_at")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Step 3: Create profile lookup
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      // Step 4: Combine data
      const creatorProfile = profileMap.get(assignment.creator_id);
      const assigneeProfile = profileMap.get(assignment.assignee_id);
      
      const assignmentWithProfiles: AssignmentWithRelations = {
        ...assignment,
        // Cast all fields to the correct types
        status: assignment.status as "not_started" | "in_progress" | "completed" | "on_hold",
        priority: assignment.priority as "normal" | "high" | "emergency",
        category: assignment.category as "general" | "inspection" | "production" | "delivery" | "admin" | "other",
        creator: creatorProfile ? { name: creatorProfile.name, email: creatorProfile.email } : null,
        assignee: assigneeProfile ? { name: assigneeProfile.name, email: assigneeProfile.email } : null,
        project: null,
      };

      return assignmentWithProfiles;
    },
  });
}

// Enhanced overdue assignments hook
export function useOverdueAssignmentsWithProfiles() {
  const { user } = useAuth();

  return useQuery<AssignmentWithRelations[]>({
    queryKey: ["overdue-assignments-with-profiles", user?.id],
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes for overdue tasks
    retry: (failureCount, error) => {
      // Retry on network errors but not on validation errors
      if (error?.message?.includes('Invalid') || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    queryFn: async () => {
      if (!user) return [];

      // Step 1: Fetch overdue assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .eq("assignee_id", user.id)
        .neq("status", "completed")
        .lt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true });

      if (assignmentsError) throw assignmentsError;
      if (!assignments || assignments.length === 0) return [];

      // Step 2: Fetch profiles
      const userIds = new Set<string>();
      assignments.forEach(assignment => {
        userIds.add(assignment.creator_id);
        userIds.add(assignment.assignee_id);
      });

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url, created_at, updated_at")
        .in("id", Array.from(userIds));

      if (profilesError) throw profilesError;

      // Step 3: Combine data
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.id, profile);
      });

      const assignmentsWithProfiles: AssignmentWithRelations[] = assignments.map(assignment => {
        const creatorProfile = profileMap.get(assignment.creator_id);
        const assigneeProfile = profileMap.get(assignment.assignee_id);
        
        return {
          ...assignment,
          // Cast all fields to the correct types
          status: assignment.status as "not_started" | "in_progress" | "completed" | "on_hold",
          priority: assignment.priority as "normal" | "high" | "emergency",
          category: assignment.category as "general" | "inspection" | "production" | "delivery" | "admin" | "other",
          creator: creatorProfile ? { name: creatorProfile.name, email: creatorProfile.email } : null,
          assignee: assigneeProfile ? { name: assigneeProfile.name, email: assigneeProfile.email } : null,
          project: null,
        };
      });

      return assignmentsWithProfiles;
    },
  });
}
