import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

// Simple, direct delete hook to prevent hanging
export function useSimpleDeleteAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log("🗑️ Simple delete starting:", id);
      
      // First check if assignment exists and user has permission
      const { data: assignment, error: fetchError } = await supabase
        .from("assignments")
        .select("id, creator_id, assignee_id")
        .eq("id", id)
        .single();
      
      if (fetchError) {
        console.error("❌ Failed to fetch assignment for delete:", fetchError);
        throw new Error("Assignment not found or access denied");
      }
      
      if (!assignment) {
        throw new Error("Assignment not found");
      }
      
      // Direct Supabase delete without extra complexity
      const { error } = await supabase
        .from("assignments")
        .delete()
        .eq("id", id);

      console.log("🗑️ Delete result:", { error });
      
      if (error) {
        console.error("❌ Simple delete failed:", error);
        // Provide more specific error messages
        if (error.message.includes('permission denied')) {
          throw new Error("You don't have permission to delete this assignment");
        } else if (error.message.includes('foreign key')) {
          throw new Error("Cannot delete assignment due to related records");
        } else {
          throw new Error(error.message || "Failed to delete assignment");
        }
      }
      
      return { success: true, id };
    },
    onSuccess: (deletedAssignment) => {
      console.log("✅ Assignment deleted successfully:", deletedAssignment);
      
      // Invalidate all assignment queries
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["my-assignments-with-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-assignments-with-profiles"] });
      
      toast({ 
        title: "Assignment deleted successfully",
        description: "The assignment has been permanently deleted."
      });
    },
    onError: (error) => {
      console.error("❌ Simple delete mutation error:", error);
      toast({ 
        variant: "destructive", 
        title: "Delete Failed", 
        description: error.message || "Failed to delete assignment" 
      });
    },
  });
}
