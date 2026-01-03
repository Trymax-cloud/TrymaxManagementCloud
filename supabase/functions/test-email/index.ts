import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    console.log("Testing email functionality...");

    // Get environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY in Edge Function secrets");
    }

    console.log("Environment variables loaded successfully");

    const resend = new Resend(resendApiKey);

    // Parse request body for test email
    const body = await req.json().catch(() => ({}));
    const testEmail = body.email || "test@example.com"; // Default for testing

    console.log(`Sending test email to: ${testEmail}`);

    const html = `
      <h2>Test Email from EWPM System</h2>
      <p>This is a test email to verify that the email sending functionality is working correctly.</p>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      <p><strong>Environment:</strong> Edge Function</p>
      <hr>
      <p><small>This is an automated test email from the EWPM System.</small></p>
    `;

    try {
      const emailResult = await resend.emails.send({
        from: "EWPM System <noreply@trymaxmanagement.com>",
        to: [testEmail],
        subject: "✅ Test Email - EWPM System Working",
        html,
      });

      console.log(`Test email sent successfully! Email ID: ${emailResult.data?.id}`);

      return new Response(
        JSON.stringify({
          message: "Test email sent successfully",
          email_id: emailResult.data?.id,
          sent_to: testEmail,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (emailError) {
      console.error("Failed to send test email:", emailError);
      
      return new Response(
        JSON.stringify({
          error: "Failed to send test email",
          details: emailError instanceof Error ? emailError.message : String(emailError),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in test-email:", error);
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
