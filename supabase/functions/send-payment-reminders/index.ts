import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    // Create Supabase client using external Supabase credentials
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const supabaseKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY");
    
    console.log("Connecting to external Supabase:", supabaseUrl ? "URL configured" : "URL missing");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Calculate reminder thresholds
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    // Fetch payments that are:
    // 1. Due in 3 days (upcoming reminder)
    // 2. Due today (due today reminder)
    // 3. Overdue (overdue reminder)
    const { data: payments, error: paymentsError } = await supabase
      .from("client_payments")
      .select("*")
      .in("status", ["pending", "partial"])
      .lte("due_date", threeDaysStr);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} payments to check`);

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No payment reminders to send", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profiles for email addresses
    const userIds = [...new Set(payments.map(p => p.responsible_user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Categorize and send reminders
    const reminders: { type: string; payment: PaymentReminder; email: string }[] = [];

    for (const payment of payments) {
      const profile = profileMap.get(payment.responsible_user_id);
      if (!profile?.email) {
        console.log(`No email found for user ${payment.responsible_user_id}, skipping`);
        continue;
      }

      const dueDate = new Date(payment.due_date);
      const balance = payment.invoice_amount - payment.amount_paid;
      
      let reminderType = "";
      if (dueDate < today) {
        reminderType = "overdue";
      } else if (payment.due_date === todayStr) {
        reminderType = "due_today";
      } else if (dueDate <= threeDaysFromNow) {
        reminderType = "upcoming";
      }

      if (reminderType) {
        reminders.push({
          type: reminderType,
          payment: {
            ...payment,
            responsible_email: profile.email,
            responsible_name: profile.name,
          },
          email: profile.email,
        });
      }
    }

    console.log(`Sending ${reminders.length} reminder emails`);

    // Send emails
    const sentEmails: string[] = [];
    const errors: string[] = [];

    for (const reminder of reminders) {
      const { type, payment, email } = reminder;
      const balance = payment.invoice_amount - payment.amount_paid;
      
      let subject = "";
      let urgencyClass = "";
      let message = "";

      switch (type) {
        case "overdue":
          subject = `🚨 OVERDUE: Payment for ${payment.client_name}`;
          urgencyClass = "overdue";
          message = `This payment is <strong>overdue</strong>. Please follow up immediately.`;
          break;
        case "due_today":
          subject = `⚠️ DUE TODAY: Payment for ${payment.client_name}`;
          urgencyClass = "due-today";
          message = `This payment is <strong>due today</strong>. Please ensure it's collected.`;
          break;
        case "upcoming":
          subject = `📅 Upcoming: Payment for ${payment.client_name}`;
          urgencyClass = "upcoming";
          message = `This payment is due soon. Please prepare for collection.`;
          break;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f7fafc; padding: 20px; border: 1px solid #e2e8f0; }
            .footer { background: #edf2f7; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #718096; }
            .amount { font-size: 24px; font-weight: bold; color: #2d3748; }
            .overdue { color: #e53e3e; }
            .due-today { color: #dd6b20; }
            .upcoming { color: #3182ce; }
            .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .detail-row:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${payment.responsible_name || 'Team'},</p>
              <p class="${urgencyClass}">${message}</p>
              
              <div class="details">
                <div class="detail-row">
                  <span>Client:</span>
                  <strong>${payment.client_name}</strong>
                </div>
                <div class="detail-row">
                  <span>Invoice Amount:</span>
                  <span>₹${payment.invoice_amount.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span>Amount Paid:</span>
                  <span>₹${payment.amount_paid.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                  <span>Balance Due:</span>
                  <strong class="amount ${urgencyClass}">₹${balance.toLocaleString()}</strong>
                </div>
                <div class="detail-row">
                  <span>Due Date:</span>
                  <strong>${new Date(payment.due_date).toLocaleDateString('en-IN', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</strong>
                </div>
              </div>
              
              <p>Please take appropriate action to ensure timely collection.</p>
            </div>
            <div class="footer">
              <p>This is an automated reminder from EWPM System.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        // Send email using Resend API directly via fetch
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "EWPM System <onboarding@resend.dev>",
            to: [email],
            subject,
            html,
          }),
        });
        
        const emailResult = await emailResponse.json();
        
        if (!emailResponse.ok) {
          throw new Error(emailResult.message || "Failed to send email");
        }
        
        console.log(`Email sent to ${email}:`, emailResult);
        sentEmails.push(email);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${email}:`, emailError);
        errors.push(`${email}: ${emailError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${sentEmails.length} payment reminder emails`,
        sent: sentEmails.length,
        emails: sentEmails,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-payment-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
