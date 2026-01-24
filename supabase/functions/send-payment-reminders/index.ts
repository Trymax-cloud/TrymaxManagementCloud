import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body = await req.json()
    const paymentIds = body.paymentIds || []

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://your-app-url.com'
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    
    // Initialize counters
    let sent = 0
    let skipped = 0

    // Get specific payments by IDs
    const { data: payments, error: fetchError } = await supabase
      .from('client_payments')
      .select('*')
      .in('id', paymentIds)
      .order('due_date', { ascending: true })

    if (fetchError) {
      console.error('Error fetching payments:', fetchError)
      throw new Error(`Failed to fetch payments: ${fetchError.message}`)
    }

    // Process each payment
    for (const payment of payments || []) {
      try {
        // Skip if payment is already paid
        if (payment.status === 'paid') {
          skipped++
          continue
        }

        // Check cooldown (24 hours since last manual reminder)
        const now = new Date()
        const lastManualReminder = payment.last_manual_reminder_sent ? new Date(payment.last_manual_reminder_sent) : null
        const cooldownHours = 24
        
        if (lastManualReminder) {
          const hoursSinceLastReminder = (now.getTime() - lastManualReminder.getTime()) / (1000 * 60 * 60)
          if (hoursSinceLastReminder < cooldownHours) {
            skipped++
            continue
          }
        }

        // Get responsible employee info for email
        let recipientEmail = null
        let recipientName = null
        if (payment.responsible_user_id) {
          // Get name from profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payment.responsible_user_id)
            .single()
          
          if (!profileError) {
            recipientName = profile?.full_name
          }
          
          // Get email from auth.users table
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
            payment.responsible_user_id
          )
          
          if (userError || !userData?.user?.email) {
            console.error('Error fetching user email:', userError)
            skipped++
            continue
          }
          
          recipientEmail = userData.user.email
        }

        if (!recipientEmail) {
          skipped++
          continue
        }

        // Send email
        if (resendApiKey) {
          try {
            const emailHtml = generatePaymentReminderEmail({
              clientName: payment.client_name || 'Valued Client',
              invoiceAmount: payment.invoice_amount,
              amountPaid: payment.amount_paid,
              dueDate: payment.due_date,
              reminderType: 'manual',
              responsibleName: recipientName,
              appUrl
            })

            const subject = `Payment Reminder – ${payment.client_name || 'Valued Client'}`

            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'EWPM System <noreply@trymaxmanagement.in>',
                to: [recipientEmail],
                subject,
                html: emailHtml,
              }),
            })

            if (!response.ok) {
              const error = await response.text()
              throw new Error(`Email service error: ${error}`)
            }

          } catch (emailError) {
            console.error('Email error:', emailError)
            continue
          }
        } else {
          console.log(`DRY RUN: Would send manual email for payment ${payment.id}`)
        }

        // Update payment record with manual reminder timestamp
        const { error: updateError } = await supabase
          .from('client_payments')
          .update({
            last_manual_reminder_sent: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', payment.id)

        if (updateError) {
          console.error('Error updating payment:', updateError)
          continue
        }

        sent++

      } catch (error) {
        console.error(`Error processing payment ${payment.id}:`, error)
      }
    }

    const result = {
      success: true,
      sent,
      skipped,
      overdue: 0,
      upcoming_72h: 0,
      upcoming_24h: 0
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in manual payment reminders function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        sent: 0,
        skipped: 0,
        overdue: 0,
        upcoming_72h: 0,
        upcoming_24h: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generatePaymentReminderEmail(data: {
  clientName: string
  invoiceAmount: number
  amountPaid: number
  dueDate: string
  reminderType: string
  responsibleName?: string
  appUrl: string
}): string {
  const { clientName, invoiceAmount, amountPaid, dueDate, reminderType, responsibleName, appUrl } = data
  const due = new Date(dueDate)
  const balance = invoiceAmount - amountPaid
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6; }
        .amount { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .due-date { font-size: 18px; font-weight: bold; color: #059669; }
        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Payment Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${responsibleName || 'Team Member'},</p>
          <p>This is a reminder to collect payment from <strong>${clientName}</strong>.</p>
          
          <div class="payment-details">
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Invoice Amount:</strong> ₹${invoiceAmount.toFixed(2)}</p>
            <p><strong>Amount Paid:</strong> ₹${amountPaid.toFixed(2)}</p>
            <p class="amount"><strong>Balance to Collect:</strong> ₹${balance.toFixed(2)}</p>
            <p class="due-date">
              <strong>Collection Due Date:</strong> ${due.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <p>Please contact the client to arrange payment collection as soon as possible.</p>
          
          <p>To view payment details and update status:</p>
          <a href="${appUrl}" class="button">View Payment Details</a>
          
          <p>If you have already collected this payment, please update payment status in the system.</p>
        </div>
        <div class="footer">
          <p>This email was sent by EWPM System</p>
          <p>If you no longer wish to receive these reminders, please contact us.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
