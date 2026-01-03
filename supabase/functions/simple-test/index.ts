import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    console.log("🔍 Simple test function called");

    const testInfo = {
      message: "Edge Function is working!",
      timestamp: new Date().toISOString(),
      method: req.method,
      env_vars: {
        SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "✅ Set" : "❌ Missing",
        SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") ? "✅ Set" : "❌ Missing",
        RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ? "✅ Set" : "❌ Missing"
      },
      headers: Object.fromEntries(req.headers.entries())
    };

    return new Response(
      JSON.stringify(testInfo, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("💥 Error in test:", error);
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
