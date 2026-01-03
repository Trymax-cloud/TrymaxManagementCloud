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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || 
                       Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ 
          error: "Missing Supabase configuration",
          setup: "Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables",
          env_vars: {
            SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
            SUPABASE_ANON_KEY: supabaseKey ? "✅ Set" : "❌ Missing",
            RESEND_API_KEY: "❌ MISSING"
          }
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized");

    // Check Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const debugInfo: any = {
      env_vars: {
        SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
        SUPABASE_ANON_KEY: supabaseKey ? "✅ Set" : "❌ Missing", 
        RESEND_API_KEY: resendApiKey ? "✅ Set" : "❌ MISSING"
      },
      payments: [],
      profiles: [],
      issues: []
    };

    if (!resendApiKey) {
      debugInfo.issues.push("❌ Missing RESEND_API_KEY in Edge Function secrets");
      debugInfo.setup = "Go to Supabase Dashboard → Edge Functions → your function → Secrets and add RESEND_API_KEY";
    } else {
      console.log("✅ RESEND_API_KEY found");
      debugInfo.issues.push("✅ RESEND_API_KEY is set");
    }

    try {
      // Get some sample payments and profiles to debug
      const { data: payments, error: paymentsError } = await supabase
        .from("client_payments")
        .select("id, client_name, responsible_user_id")
        .limit(3);

      if (paymentsError) {
        debugInfo.issues.push(`❌ Failed to fetch payments: ${paymentsError.message}`);
      } else {
        console.log(`📊 Found ${payments?.length || 0} payments`);
        debugInfo.payments = payments?.map((p: any) => ({
          id: p.id,
          client_name: p.client_name,
          responsible_user_id: p.responsible_user_id,
          has_profile: false
        })) || [];

        if (payments && payments.length > 0) {
          // Get user profiles for these payments
          const userIds = payments.map((p: any) => p.responsible_user_id);
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, email, name")
            .in("id", userIds);

          if (profilesError) {
            debugInfo.issues.push(`❌ Failed to fetch profiles: ${profilesError.message}`);
          } else {
            console.log(`👥 Found ${profiles?.length || 0} user profiles`);
            debugInfo.profiles = profiles?.map((p: any) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              has_email: !!p.email
            })) || [];

            // Update payments with profile info
            debugInfo.payments = debugInfo.payments.map((payment: any) => ({
              ...payment,
              has_profile: profiles?.some((profile: any) => profile.id === payment.responsible_user_id) || false
            }));

            // Check for common issues
            if (!profiles || profiles.length === 0) {
              debugInfo.issues.push("❌ No user profiles found - users may not have email addresses");
            }

            const profilesWithoutEmail = profiles?.filter((p: any) => !p.email) || [];
            if (profilesWithoutEmail.length > 0) {
              debugInfo.issues.push(`❌ ${profilesWithoutEmail.length} users missing email addresses`);
            }

            if (debugInfo.issues.length === 1 && debugInfo.issues[0].includes("✅")) {
              debugInfo.issues.push("✅ Everything looks good for email sending!");
            }
          }
        } else {
          debugInfo.issues.push("ℹ️ No payments found in database - add some payments first");
        }
      }
    } catch (dbError) {
      debugInfo.issues.push(`❌ Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    return new Response(
      JSON.stringify(debugInfo, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("💥 Error in debug:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
        troubleshooting: "Check Supabase Edge Function logs for more details"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
