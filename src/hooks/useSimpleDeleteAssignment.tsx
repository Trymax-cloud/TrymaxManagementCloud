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
      
      try {
        // Direct Supabase delete without permission check to avoid hanging
        // Add timeout to prevent hanging
        const deletePromise = supabase
          .from("assignments")
          .delete({ count: 'exact' })
          .eq("id", id);

        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Delete operation timed out')), 10000); // 10 second timeout
        });

        const { error, count } = await Promise.race([deletePromise, timeoutPromise]) as any;

        console.log("🗑️ Delete result:", { error, count });

        if (error) {
          console.error("❌ Simple delete failed:", error);
          // Provide more specific error messages
          if (error.message.includes('permission denied') || error.code === '42501') {
            throw new Error("You don't have permission to delete this assignment");
          } else if (error.message.includes('foreign key') || error.code === '23503') {
            throw new Error("Cannot delete assignment due to related records");
          } else {
            throw new Error(error.message || "Failed to delete assignment");
          }
        }

        if (count === 0) {
          throw new Error("Assignment not found or already deleted");
        }

        return { success: true, id };
      } catch (err) {
        console.error("❌ Delete operation failed:", err);
        throw err;
      }
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
