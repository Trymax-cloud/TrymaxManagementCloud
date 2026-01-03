import { supabase } from "@/integrations/supabase/client";

// Diagnostic functions to check database integrity

export async function diagnoseProfileIssues() {
  console.log("🔍 DIAGNOSING PROFILE ISSUES...");
  
  const results = {
    profilesCount: 0,
    assignmentsCount: 0,
    missingCreatorProfiles: [] as string[],
    missingAssigneeProfiles: [] as string[],
    sampleAssignments: [] as any[],
    sampleProfiles: [] as any[],
    profileErrors: [] as string[]
  };

  try {
    // 1. Check total profiles count
    const { count: profilesCount, error: profilesError } = await supabase
      .from("profiles")
      .select("*", { count: 'exact', head: true });
    
    if (profilesError) {
      results.profileErrors.push(`Profiles count error: ${profilesError.message}`);
    } else {
      results.profilesCount = profilesCount || 0;
    }

    // 2. Check total assignments count
    const { count: assignmentsCount, error: assignmentsError } = await supabase
      .from("assignments")
      .select("*", { count: 'exact', head: true });
    
    if (assignmentsError) {
      results.profileErrors.push(`Assignments count error: ${assignmentsError.message}`);
    } else {
      results.assignmentsCount = assignmentsCount || 0;
    }

    // 3. Get sample assignments to check creator/assignee IDs
    const { data: sampleAssignments, error: sampleError } = await supabase
      .from("assignments")
      .select("id, creator_id, assignee_id, title")
      .limit(5);
    
    if (sampleError) {
      results.profileErrors.push(`Sample assignments error: ${sampleError.message}`);
    } else {
      results.sampleAssignments = sampleAssignments || [];
      
      // Check for missing creator profiles
      for (const assignment of sampleAssignments) {
        const { data: creatorProfile, error: creatorError } = await supabase
          .from("profiles")
          .select("id, name, email")
          .eq("id", assignment.creator_id)
          .single();
        
        if (creatorError || !creatorProfile) {
          results.missingCreatorProfiles.push(assignment.creator_id);
        }
      }

      // Check for missing assignee profiles
      for (const assignment of sampleAssignments) {
        const { data: assigneeProfile, error: assigneeError } = await supabase
          .from("profiles")
          .select("id, name, email")
          .eq("id", assignment.assignee_id)
          .single();
        
        if (assigneeError || !assigneeProfile) {
          results.missingAssigneeProfiles.push(assignment.assignee_id);
        }
      }
    }

    // 4. Get sample profiles
    const { data: sampleProfiles, error: sampleProfilesError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .limit(5);
    
    if (sampleProfilesError) {
      results.profileErrors.push(`Sample profiles error: ${sampleProfilesError.message}`);
    } else {
      results.sampleProfiles = sampleProfiles || [];
    }

    // 5. Test the problematic join query
    const { data: joinTest, error: joinError } = await supabase
      .from("assignments")
      .select(`
        *,
        creator:profiles!assignments_creator_id_fkey (
          id,
          name,
          email
        ),
        assignee:profiles!assignments_assignee_id_fkey (
          id,
          name,
          email
        )
      `)
      .limit(1);
    
    if (joinError) {
      results.profileErrors.push(`Join test error: ${joinError.message}`);
    } else {
      console.log("✅ Join test successful:", joinTest);
    }

  } catch (error: any) {
    results.profileErrors.push(`General error: ${error.message}`);
  }

  console.log("🔍 DIAGNOSTIC RESULTS:", results);
  return results;
}

export async function testProfileJoin(userId: string) {
  console.log(`🔍 Testing profile join for user: ${userId}`);
  
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, avatar_url")
      .eq("id", userId)
      .single();
    
    console.log(`Profile result for ${userId}:`, { data, error });
    return { data, error };
  } catch (error: any) {
    console.error(`Profile test error for ${userId}:`, error);
    return { data: null, error };
  }
}
