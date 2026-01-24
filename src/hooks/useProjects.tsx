import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { PROJECT_STAGES, type ProjectStage, STAGE_NORMALIZATION } from "@/constants/projectStages";

export interface Project {
  id: string;
  name: string;
  client_name: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  status: "active" | "completed" | "on_hold" | "cancelled";
  stage: ProjectStage;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Apply backward compatibility normalization
      const normalizedData = (data as Project[]).map(project => ({
        ...project,
        stage: STAGE_NORMALIZATION[project.stage] || project.stage
      }));
      
      return normalizedData;
    },
    enabled: !!user,
  });
}

export function useActiveProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["active-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      
      // Apply backward compatibility normalization
      const normalizedData = (data as Project[]).map(project => ({
        ...project,
        stage: STAGE_NORMALIZATION[project.stage] || project.stage
      }));
      
      return normalizedData;
    },
    enabled: !!user,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Apply backward compatibility normalization
      const normalizedData = {
        ...data as Project,
        stage: STAGE_NORMALIZATION[data.stage] || data.stage
      };
      
      return normalizedData;
    },
    enabled: !!id,
  });
}

export interface CreateProjectInput {
  name: string;
  client_name: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

export interface UpdateProjectInput {
  name: string;
  client_name: string;
  start_date: string;
  end_date?: string;
  description?: string;
  status: "active" | "completed" | "on_hold" | "cancelled";
  stage: ProjectStage;
}

export function useCreateProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["active-projects"] });
      toast({
        title: "Project created",
        description: "The project has been created successfully.",
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

export function useUpdateProjectStage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, stage }: { projectId: string; stage: ProjectStage }) => {
      const { data, error } = await supabase
        .from("projects")
        .update({ stage })
        .eq("id", projectId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["active-projects"] });
      toast({
        title: "Stage updated",
        description: "Project stage has been updated.",
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

export function useUpdateProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProjectInput }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      await queryClient.cancelQueries({ queryKey: ["active-projects"] });

      // Snapshot the previous value
      const previousProjects = queryClient.getQueryData(["projects"]);
      const previousActiveProjects = queryClient.getQueryData(["active-projects"]);

      // Optimistically update the project in the cache
      queryClient.setQueryData(["projects"], (old: Project[] | undefined) => {
        if (!old) return old;
        return old.map(project => 
          project.id === id ? { ...project, ...input } : project
        );
      });

      queryClient.setQueryData(["active-projects"], (old: Project[] | undefined) => {
        if (!old) return old;
        return old.map(project => 
          project.id === id ? { ...project, ...input } : project
        );
      });

      return { previousProjects, previousActiveProjects };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousProjects) {
        queryClient.setQueryData(["projects"], context.previousProjects);
      }
      if (context?.previousActiveProjects) {
        queryClient.setQueryData(["active-projects"], context.previousActiveProjects);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
    onSuccess: (updatedProject) => {
      queryClient.setQueriesData(
        {
          predicate: q =>
            Array.isArray(q.queryKey) && q.queryKey[0] === "projects"
        },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(p =>
            p.id === updatedProject.id ? updatedProject : p
          );
        }
      );
      toast({
        title: "Project updated",
        description: "The project has been updated successfully.",
      });
    },
  });
}

export function useDeleteProject() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["active-projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been deleted successfully.",
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
