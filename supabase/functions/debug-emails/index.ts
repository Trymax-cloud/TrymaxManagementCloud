import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 DEBUG: Checking email setup...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || 
                       Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized");

    // Check Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          error: "Missing RESEND_API_KEY in Edge Function secrets",
          setup: "Go to Supabase Dashboard → Edge Functions → your function → Secrets",
          env_vars: {
            SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
            SUPABASE_ANON_KEY: supabaseKey ? "✅ Set" : "❌ Missing",
            RESEND_API_KEY: "❌ MISSING"
          }
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ RESEND_API_KEY found");

    // Get some sample payments and profiles to debug
    const { data: payments, error: paymentsError } = await supabase
      .from("client_payments")
      .select("id, client_name, responsible_user_id")
      .limit(3);

    if (paymentsError) {
      throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    console.log(`📊 Found ${payments?.length || 0} payments`);

    if (payments && payments.length > 0) {
      // Get user profiles for these payments
      const userIds = payments.map(p => p.responsible_user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", userIds);

      if (profilesError) {
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      }

      console.log(`👥 Found ${profiles?.length || 0} user profiles`);

      const debugInfo = {
        env_vars: {
          SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
          SUPABASE_ANON_KEY: supabaseKey ? "✅ Set" : "❌ Missing", 
          RESEND_API_KEY: resendApiKey ? "✅ Set" : "❌ Missing"
        },
        payments: payments?.map(p => ({
          id: p.id,
          client_name: p.client_name,
          responsible_user_id: p.responsible_user_id,
          has_profile: profiles?.some(profile => profile.id === p.responsible_user_id)
        })) || [],
        profiles: profiles?.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          has_email: !!p.email
        })) || [],
        issues: []
      };

      // Check for common issues
      if (!profiles || profiles.length === 0) {
        debugInfo.issues.push("❌ No user profiles found - users may not have email addresses");
      }

      const profilesWithoutEmail = profiles?.filter(p => !p.email) || [];
      if (profilesWithoutEmail.length > 0) {
        debugInfo.issues.push(`❌ ${profilesWithoutEmail.length} users missing email addresses`);
      }

      if (debugInfo.issues.length === 0) {
        debugInfo.issues.push("✅ Everything looks good for email sending!");
      }

      return new Response(
        JSON.stringify(debugInfo, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ 
          message: "No payments found in database",
          env_vars: {
            SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
            SUPABASE_ANON_KEY: supabaseKey ? "✅ Set" : "❌ Missing",
            RESEND_API_KEY: resendApiKey ? "✅ Set" : "❌ Missing"
          },
          suggestion: "Add some payments first, then test email sending"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("💥 Error in debug:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
