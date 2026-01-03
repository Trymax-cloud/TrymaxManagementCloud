import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

// Very simple delete hook - no complexity
export function useSimpleAssignmentDelete() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("🗑️ Delete assignment:", id);
      
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete failed:", error);
        throw new Error("Failed to delete assignment");
      }

      return { success: true };
    },
    onSuccess: () => {
      toast({ title: "Assignment deleted" });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
    },
    onError: (error) => {
      toast({ 
        variant: "destructive", 
        title: "Delete failed", 
        description: error.message 
      });
    },
  });
}
