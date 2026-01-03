import { supabase } from "@/integrations/supabase/client";

// Test function to check if we can fetch assignments directly
export async function testAssignmentsFetch() {
  try {
    console.log("Testing direct assignment fetch...");
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .limit(5);
    
    console.log("Direct fetch result:", { data, error });
    return { data, error };
  } catch (err) {
    console.error("Direct fetch error:", err);
    return { data: null, error: err };
  }
}
