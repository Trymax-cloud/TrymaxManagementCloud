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
  last_72h_reminder_sent?: string;
  last_24h_reminder_sent?: string;
  last_overdue_reminder_sent?: string;
}

interface ReminderRequest {
  payment_ids?: string[]; // Optional: specific payment IDs to process
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting payment reminder check...");

    // Parse request body for optional payment IDs
    let paymentIds: string[] = [];
    if (req.method === "POST") {
      const body: ReminderRequest = await req.json().catch(() => ({}));
      paymentIds = body.payment_ids || [];
      console.log(`Processing ${paymentIds.length} specific payment IDs`);
    }

    // Get environment variables with explicit error checking
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Explicit guard to throw error if env vars are missing
    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL in Edge Function secrets");
    }

    if (!supabaseKey) {
      throw new Error("Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY in Edge Function secrets");
    }

    console.log("Environment variables loaded successfully");

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Calculate time windows
    const twentyFourHoursFromNow = new Date(today);
    twentyFourHoursFromNow.setDate(twentyFourHoursFromNow.getDate() + 1);
    const twentyFourStr = twentyFourHoursFromNow.toISOString().split("T")[0];

    const seventyTwoHoursFromNow = new Date(today);
    seventyTwoHoursFromNow.setDate(seventyTwoHoursFromNow.getDate() + 3);
    const seventyTwoStr = seventyTwoHoursFromNow.toISOString().split("T")[0];

    console.log(`Checking payments with due dates up to ${seventyTwoStr}`);

    let payments: PaymentReminder[] = [];

    if (paymentIds.length > 0) {
      // Process specific payment IDs
      const { data: specificPayments, error: specificError } = await supabase
        .from("client_payments")
        .select("*")
        .in("id", paymentIds);

      if (specificError) {
        throw new Error(`Failed to fetch specific payments: ${specificError.message}`);
      }

      payments = specificPayments || [];
      console.log(`Found ${payments.length} specific payments to process`);
    } else {
      // Process only overdue payments when no specific IDs provided
      const { data: overduePayments, error: overdueError } = await supabase
        .from("client_payments")
        .select("*")
        .in("status", ["pending", "partially_paid"])
        .lt("due_date", todayStr);

      if (overdueError) {
        throw new Error(`Failed to fetch overdue payments: ${overdueError.message}`);
      }

      payments = overduePayments || [];
      console.log(`Found ${payments.length} overdue payments to process`);
    }

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: paymentIds.length > 0 ? "No eligible payments found for selected IDs" : "No overdue payments require reminders", 
          sent: 0 
        }),
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

    // Categorize and filter payments based on reminder rules
    const reminders: { payment: PaymentReminder; type: string; reason: string }[] = [];

    for (const payment of payments) {
      // Skip if already paid
      if (payment.status === "paid") {
        console.log(`Skipping payment ${payment.id} - already paid`);
        continue;
      }

      const profile = profileMap.get(payment.responsible_user_id);
      const paymentWithEmail: PaymentReminder = {
        ...payment,
        responsible_email: profile?.email,
        responsible_name: profile?.name,
      };

      const dueDate = new Date(payment.due_date);
      
      // Check if reminder tracking columns exist, if not, treat as never sent
      const last72hSent = payment.last_72h_reminder_sent ? new Date(payment.last_72h_reminder_sent) : null;
      const last24hSent = payment.last_24h_reminder_sent ? new Date(payment.last_24h_reminder_sent) : null;
      const lastOverdueSent = payment.last_overdue_reminder_sent ? new Date(payment.last_overdue_reminder_sent) : null;
      
      // Rule a: 72-hour reminder
      if (dueDate <= seventyTwoHoursFromNow && dueDate >= today && !last72hSent) {
        reminders.push({ 
          payment: paymentWithEmail, 
          type: "upcoming_72h", 
          reason: "Payment due within 72 hours" 
        });
      }
      // Rule b: 24-hour reminder
      else if (dueDate <= twentyFourHoursFromNow && dueDate >= today && !last24hSent) {
        reminders.push({ 
          payment: paymentWithEmail, 
          type: "upcoming_24h", 
          reason: "Payment due within 24 hours" 
        });
      }
      // Rule c: Overdue reminder
      else if (dueDate < today && !lastOverdueSent) {
        reminders.push({ 
          payment: paymentWithEmail, 
          type: "overdue", 
          reason: "Payment is overdue" 
        });
      }
      else {
        console.log(`Skipping payment ${payment.id} - reminder already sent or not eligible`);
        console.log(`  Due date: ${payment.due_date}, Today: ${todayStr}`);
        console.log(`  Status: ${payment.status}`);
        console.log(`  Last reminders: 72h=${!!last72hSent}, 24h=${!!last24hSent}, overdue=${!!lastOverdueSent}`);
      }
    }

    console.log(`Sending ${reminders.length} reminder emails`);

    // Send emails
    let successCount = 0;
    let failCount = 0;

    for (const { payment, type, reason } of reminders) {
      if (!payment.responsible_email) {
        console.log(`Skipping payment ${payment.id} - no email found for responsible user ${payment.responsible_user_id}`);
        continue;
      }

      console.log(`Sending ${type} reminder to responsible person: ${payment.responsible_email} for payment ${payment.id}`);

      const subject = type === "overdue"
        ? `⚠️ OVERDUE: Payment from ${payment.client_name}`
        : type === "upcoming_24h"
        ? `📅 DUE SOON: Payment from ${payment.client_name} (within 24h)`
        : `🔔 UPCOMING: Payment from ${payment.client_name} (within 72h)`;

      const html = `
        <h2>Payment Reminder</h2>
        <p>Hello ${payment.responsible_name || "Team"},</p>
        <p>You are responsible for the following payment:</p>
        <p><strong>Client:</strong> ${payment.client_name}</p>
        <p><strong>Amount:</strong> $${payment.invoice_amount.toLocaleString()}</p>
        <p><strong>Due Date:</strong> ${payment.due_date}</p>
        <p><strong>Status:</strong> ${payment.status}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please take appropriate action to collect this payment.</p>
        <hr>
        <p><small>This is an automated reminder from the EWPM System.</small></p>
      `;

      try {
        const emailResult = await resend.emails.send({
          from: "EWPM System <noreply@trymaxmanagement.com>",
          to: [payment.responsible_email],
          subject,
          html,
        });
        
        console.log(`Email sent successfully to ${payment.responsible_email}. Email ID: ${emailResult.data?.id}`);
        successCount++;
        console.log(`Sent ${type} reminder for payment ${payment.id}`);

        // Update the corresponding reminder timestamp
        const updateField = type === "overdue" 
          ? "last_overdue_reminder_sent" 
          : type === "upcoming_24h" 
          ? "last_24h_reminder_sent" 
          : "last_72h_reminder_sent";

        // Try to update the reminder timestamp, but don't fail if columns don't exist yet
        try {
          await supabase
            .from("client_payments")
            .update({ [updateField]: new Date().toISOString() })
            .eq("id", payment.id);
          console.log(`Updated ${updateField} for payment ${payment.id}`);
        } catch (updateError) {
          console.warn(`Failed to update reminder timestamp for payment ${payment.id}:`, updateError);
          // Don't fail the whole operation if timestamp update fails
          // This can happen if the migration hasn't been applied yet
        }

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
        processed_ids: reminders.map(r => r.payment.id),
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
