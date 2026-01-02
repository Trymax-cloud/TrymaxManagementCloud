import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminder {
  id: string;
  client_name: string;
  invoice_amount: number;
  amount_paid: number;
  due_date: string;
  status: string;
  responsible_user_id: string;
  responsible_email?: string;
  responsible_name?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting payment reminder check...");

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Calculate 3 days from now
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

    console.log(`Checking payments due between ${todayStr} and ${threeDaysStr}`);

    // Fetch pending/partially paid payments
    const { data: payments, error: paymentsError } = await supabase
      .from("client_payments")
      .select("*")
      .in("status", ["pending", "partially_paid"])
      .lte("due_date", threeDaysStr);

    if (paymentsError) {
      throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    console.log(`Found ${payments?.length || 0} payments to process`);

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No payments require reminders", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(payments.map((p) => p.responsible_user_id))];

    // Fetch user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", userIds);

    if (profilesError) {
      console.error("Failed to fetch profiles:", profilesError);
    }

    // Create email lookup
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    // Categorize payments
    const reminders: { payment: PaymentReminder; type: string }[] = [];

    for (const payment of payments) {
      const profile = profileMap.get(payment.responsible_user_id);
      const paymentWithEmail: PaymentReminder = {
        ...payment,
        responsible_email: profile?.email,
        responsible_name: profile?.name,
      };

      const dueDate = new Date(payment.due_date);
      
      if (dueDate < today) {
        reminders.push({ payment: paymentWithEmail, type: "overdue" });
      } else if (payment.due_date === todayStr) {
        reminders.push({ payment: paymentWithEmail, type: "due_today" });
      } else {
        reminders.push({ payment: paymentWithEmail, type: "upcoming" });
      }
    }

    console.log(`Sending ${reminders.length} reminder emails`);

    // Send emails
    let successCount = 0;
    let failCount = 0;

    for (const { payment, type } of reminders) {
      if (!payment.responsible_email) {
        console.log(`Skipping payment ${payment.id} - no email found`);
        continue;
      }

      const subject = type === "overdue"
        ? `⚠️ OVERDUE: Payment from ${payment.client_name}`
        : type === "due_today"
        ? `📅 DUE TODAY: Payment from ${payment.client_name}`
        : `🔔 UPCOMING: Payment from ${payment.client_name} due soon`;

      const html = `
        <h2>Payment Reminder</h2>
        <p>Hello ${payment.responsible_name || "Team"},</p>
        <p><strong>Client:</strong> ${payment.client_name}</p>
        <p><strong>Amount:</strong> $${payment.invoice_amount.toLocaleString()}</p>
        <p><strong>Due Date:</strong> ${payment.due_date}</p>
        <p><strong>Status:</strong> ${payment.status}</p>
        <p>Please take appropriate action.</p>
      `;

      try {
        await resend.emails.send({
          from: "EWPM System <noreply@yourdomain.com>",
          to: [payment.responsible_email],
          subject,
          html,
        });
        successCount++;
        console.log(`Sent reminder for payment ${payment.id}`);
      } catch (emailError) {
        failCount++;
        console.error(`Failed to send email for payment ${payment.id}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Payment reminders processed",
        sent: successCount,
        failed: failCount,
        total: reminders.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-payment-reminders:", error);
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
