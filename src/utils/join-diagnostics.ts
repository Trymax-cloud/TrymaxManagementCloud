import { supabase } from "@/integrations/supabase/client";

// Test specific join issues

export async function testSpecificJoins() {
  console.log("🔍 TESTING SPECIFIC JOINS...");
  
  // Test 1: Get a sample assignment with its creator and assignee IDs
  const { data: sampleAssignment, error: sampleError } = await supabase
    .from("assignments")
    .select("id, creator_id, assignee_id, title")
    .limit(1)
    .single();
  
  if (sampleError || !sampleAssignment) {
    console.error("❌ No sample assignment found:", sampleError);
    return;
  }
  
  console.log("📝 Sample assignment:", sampleAssignment);
  
  // Test 2: Check if creator profile exists
  const { data: creatorProfile, error: creatorError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("id", sampleAssignment.creator_id)
    .single();
  
  console.log("👤 Creator profile:", { data: creatorProfile, error: creatorError });
  
  // Test 3: Check if assignee profile exists
  const { data: assigneeProfile, error: assigneeError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("id", sampleAssignment.assignee_id)
    .single();
  
  console.log("👤 Assignee profile:", { data: assigneeProfile, error: assigneeError });
  
  // Test 4: Try the join that's failing
  const { data: joinResult, error: joinError } = await supabase
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
    .eq("id", sampleAssignment.id)
    .single();
  
  console.log("🔗 Join result:", { data: joinResult, error: joinError });
  
  // Test 5: Try a simpler join without foreign key notation
  const { data: simpleJoinResult, error: simpleJoinError } = await supabase
    .from("assignments")
    .select(`
      *,
      creator:profiles (
        id,
        name,
        email
      ),
      assignee:profiles (
        id,
        name,
        email
      )
    `)
    .eq("id", sampleAssignment.id)
    .single();
  
  console.log("🔗 Simple join result:", { data: simpleJoinResult, error: simpleJoinError });
  
  // Test 6: Try left join style
  const { data: leftJoinResult, error: leftJoinError } = await supabase
    .from("assignments")
    .select(`
      id,
      title,
      creator_id,
      assignee_id,
      creator:profiles!creator_id (
        id,
        name,
        email
      ),
      assignee:profiles!assignee_id (
        id,
        name,
        email
      )
    `)
    .eq("id", sampleAssignment.id)
    .single();
  
  console.log("🔗 Left join result:", { data: leftJoinResult, error: leftJoinError });
  
  return {
    sampleAssignment,
    creatorProfile,
    assigneeProfile,
    joinResult,
    simpleJoinResult,
    leftJoinResult
  };
}

export async function testAllUserProfiles() {
  console.log("🔍 TESTING ALL USER PROFILES...");
  
  // Get all unique user IDs from assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("creator_id, assignee_id");
  
  if (assignmentsError) {
    console.error("❌ Error getting assignments:", assignmentsError);
    return;
  }
  
  // Extract unique user IDs
  const userIds = new Set<string>();
  assignments?.forEach(assignment => {
    userIds.add(assignment.creator_id);
    userIds.add(assignment.assignee_id);
  });
  
  console.log(`👥 Found ${userIds.size} unique user IDs`);
  
  // Check each user's profile
  const profileResults = [];
  for (const userId of Array.from(userIds)) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", userId)
      .single();
    
    profileResults.push({
      userId,
      profile,
      error,
      exists: !error && !!profile
    });
  }
  
  const missingProfiles = profileResults.filter(r => !r.exists);
  console.log(`❌ ${missingProfiles.length} profiles missing:`, missingProfiles);
  console.log(`✅ ${profileResults.length - missingProfiles.length} profiles found`);
  
  return profileResults;
}
