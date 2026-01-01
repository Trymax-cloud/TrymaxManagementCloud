import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface EmployeeRating {
  id: string;
  user_id: string;
  period_type: "monthly" | "yearly";
  period_value: string;
  score: number;
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RatingWithProfile extends EmployeeRating {
  profile?: {
    id: string;
    name: string;
    email: string;
  };
}

export function useMyRatings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-ratings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_ratings")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmployeeRating[];
    },
    enabled: !!user,
  });
}

// Note: RLS policies ensure employees only see their own ratings
// Directors see all ratings via "Directors can manage ratings" policy
export function useAllRatings(periodType?: string, periodValue?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-ratings", periodType, periodValue],
    queryFn: async () => {
      let query = supabase
        .from("employee_ratings")
        .select("*")
        .order("created_at", { ascending: false });

      if (periodType) {
        query = query.eq("period_type", periodType);
      }
      if (periodValue) {
        query = query.eq("period_value", periodValue);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmployeeRating[];
    },
    enabled: !!user,
  });
}

export interface CreateRatingInput {
  user_id: string;
  period_type: "monthly" | "yearly";
  period_value: string;
  score: number;
  remarks?: string;
}

export function useCreateRating() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRatingInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("employee_ratings")
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
      queryClient.invalidateQueries({ queryKey: ["all-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["my-ratings"] });
      toast({
        title: "Rating submitted",
        description: "The employee rating has been saved successfully.",
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

export function useUpdateRating() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<CreateRatingInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("employee_ratings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["my-ratings"] });
      toast({
        title: "Rating updated",
        description: "The rating has been updated successfully.",
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
