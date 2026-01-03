import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminder {
  id: string;
  client_name: string;
  invoice_amount: number;
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
    console.log("🚀 Starting payment reminder process...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || 
                       Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY in Edge Function secrets");
    }

    const resend = new Resend(resendApiKey);
    console.log("✅ Services initialized successfully");

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const paymentIds = body.payment_ids || [];
    console.log(`📋 Processing ${paymentIds.length > 0 ? paymentIds.length + ' specific' : 'overdue'} payments`);

    // Get payments to process
    let payments: PaymentReminder[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

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
    } else {
      // Process only overdue payments
      const { data: overduePayments, error: overdueError } = await supabase
        .from("client_payments")
        .select("*")
        .in("status", ["pending", "partially_paid"])
        .lt("due_date", todayStr);

      if (overdueError) {
        throw new Error(`Failed to fetch overdue payments: ${overdueError.message}`);
      }
      payments = overduePayments || [];
    }

    console.log(`📊 Found ${payments.length} payments to process`);

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: paymentIds.length > 0 ? "No eligible payments found for selected IDs" : "No overdue payments require reminders", 
          sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profiles
    const userIds = [...new Set(payments.map((p) => p.responsible_user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", userIds);

    if (profilesError) {
      throw new Error(`Failed to fetch user profiles: ${profilesError.message}`);
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    console.log(`👥 Found ${profiles?.length || 0} user profiles`);

    // Process each payment
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const payment of payments) {
      try {
        // Skip if already paid
        if (payment.status === "paid") {
          console.log(`⏭️  Skipping payment ${payment.id} - already paid`);
          continue;
        }

        const profile = profileMap.get(payment.responsible_user_id);
        if (!profile?.email) {
          console.log(`⚠️  Skipping payment ${payment.id} - no email found for user ${payment.responsible_user_id}`);
          continue;
        }

        // Determine reminder type
        const dueDate = new Date(payment.due_date);
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let reminderType = "overdue";
        let urgency = "High";
        let subject = "⚠️ OVERDUE PAYMENT REMINDER";
        
        if (daysDiff >= 0) {
          if (daysDiff <= 1) {
            reminderType = "due_soon";
            urgency = "Critical";
            subject = "🔴 PAYMENT DUE WITHIN 24 HOURS";
          } else if (daysDiff <= 3) {
            reminderType = "upcoming";
            urgency = "Medium";
            subject = "🟡 PAYMENT DUE WITHIN 72 HOURS";
          }
        }

        // Create professional email content
        const emailHtml = createProfessionalEmail(payment, profile, reminderType, daysDiff);
        
        console.log(`📧 Sending ${reminderType} reminder to ${profile.email} for payment ${payment.id}`);

        // Send email
        const emailResult = await resend.emails.send({
          from: "EWPM System <noreply@trymaxmanagement.in>", // Production domain
          to: [profile.email],
          subject,
          html: emailHtml,
        });

        if (emailResult.error) {
          throw new Error(emailResult.error.message);
        }

        console.log(`✅ Email sent successfully to ${profile.email}. ID: ${emailResult.data?.id}`);
        successCount++;

        results.push({
          payment_id: payment.id,
          client_name: payment.client_name,
          recipient: profile.email,
          reminder_type: reminderType,
          email_id: emailResult.data?.id,
          status: "sent"
        });

      } catch (error) {
        console.error(`❌ Failed to process payment ${payment.id}:`, error);
        failCount++;
        results.push({
          payment_id: payment.id,
          client_name: payment.client_name,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`🎯 Process complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: "Payment reminders processed successfully",
        sent: successCount,
        failed: failCount,
        total: payments.length,
        results,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("💥 Error in payment reminders:", error);
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

function createProfessionalEmail(payment: PaymentReminder, profile: any, reminderType: string, daysDiff: number): string {
  const isOverdue = daysDiff < 0;
  const urgencyColor = isOverdue ? "#dc2626" : daysDiff <= 1 ? "#f59e0b" : "#3b82f6";
  const urgencyBg = isOverdue ? "#fef2f2" : daysDiff <= 1 ? "#fffbeb" : "#eff6ff";
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Reminder - EWPM System</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .payment-details { background-color: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #374151; }
        .detail-value { color: #6b7280; }
        .amount { font-size: 24px; font-weight: bold; color: #111827; }
        .urgent { color: ${urgencyColor}; font-weight: bold; }
        .footer { background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
        .action-button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .action-button:hover { background-color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Payment Collection Reminder</h1>
            <p>Employee Work & Project Management System</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${profile.name || "Team Member"}</strong>,</p>
            
            <p>This is an automated reminder that you are responsible for collecting the following payment:</p>
            
            <div class="payment-details">
                <div class="detail-row">
                    <span class="detail-label">Client Name:</span>
                    <span class="detail-value">${payment.client_name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Amount Due:</span>
                    <span class="detail-value amount">₹${payment.invoice_amount.toLocaleString('en-IN')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Due Date:</span>
                    <span class="detail-value urgent">${new Date(payment.due_date).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${payment.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Days ${isOverdue ? 'Overdue' : 'Remaining'}:</span>
                    <span class="detail-value urgent">${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} ${isOverdue ? 'overdue' : 'remaining'}</span>
                </div>
            </div>
            
            <p><strong>Urgency Level:</strong> <span class="urgent">${isOverdue ? 'HIGH - PAYMENT OVERDUE' : daysDiff <= 1 ? 'CRITICAL - DUE WITHIN 24H' : 'MEDIUM - FOLLOW UP REQUIRED'}</span></p>
            
            <p>Please take immediate action to collect this payment. If you have already collected it, please update the payment status in the system.</p>
            
            <a href="https://trymaxmanagement.in/payments" class="action-button">
                View Payment Details →
            </a>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
                <li>Contact the client regarding the payment</li>
                <li>Follow up on any pending invoices</li>
                <li>Update the payment status once collected</li>
                <li>Document any payment arrangements made</li>
            </ol>
        </div>
        
        <div class="footer">
            <p><small>This is an automated reminder from the EWPM System.</small></p>
            <p><small>If you believe this is an error, please contact your administrator.</small></p>
            <p><small>Generated on: ${new Date().toLocaleString()}</small></p>
        </div>
    </div>
</body>
</html>
  `;
}
