import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

// Direct delete hook - no dialogs, no complexity
export function useDirectDeleteAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("🗑️ Direct delete assignment:", id);
      
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Delete failed:", error);
        throw new Error("Failed to delete assignment");
      }

      return { success: true, id };
    },
    onSuccess: (data) => {
      console.log("✅ Assignment deleted:", data.id);
      toast({ 
        title: "Assignment deleted", 
        description: "Assignment has been removed successfully." 
      });
      
      // Invalidate all assignment queries
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments-with-profiles"] });
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
