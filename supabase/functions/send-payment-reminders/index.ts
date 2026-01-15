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
    console.log('Payment reminders function started')
    
    // Parse request body
    const body = await req.json()
    const automatic = body.automatic !== false // Default to true unless explicitly false
    const paymentRemindersEnabled = body.paymentRemindersEnabled !== false // Default to true unless explicitly false
    
    console.log('Payment reminders configuration:', {
      automatic,
      paymentRemindersEnabled,
      reminderDays: body.reminderDays,
      reminderTime: body.reminderTime
    })

    // Check if payment reminders are disabled
    if (!paymentRemindersEnabled) {
      console.log('🔔 Payment reminders disabled in settings, skipping all reminders');
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          skipped: 0,
          overdue: 0,
          upcoming_72h: 0,
          upcoming_24h: 0,
          message: 'Payment reminders disabled in user settings'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://your-app-url.com'
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasResendKey: !!resendApiKey,
      appUrl
    })

    // Get current date and time
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
    
    // Get user settings for reminder timing (default to 3 days if not set)
    const defaultReminderDays = 3; // Default fallback
    
    // Calculate reminder dates based on user settings
    const reminderDays = body.reminderDays || defaultReminderDays;
    const reminderDate = new Date(today.getTime() + reminderDays * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    console.log('Date calculations:', {
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      reminderDate: reminderDate.toISOString(),
      reminderDays: reminderDays
    })

    // Initialize counters
    let sent = 0
    let skipped = 0
    let overdue = 0
    let upcoming_72h = 0
    let upcoming_24h = 0

    // Get all unpaid payments
    const { data: payments, error: fetchError } = await supabase
      .from('client_payments')
      .select('*')
      .neq('status', 'paid')
      .order('due_date', { ascending: true })

    if (fetchError) {
      console.error('Error fetching payments:', fetchError)
      throw new Error(`Failed to fetch payments: ${fetchError.message}`)
    }

    console.log(`Found ${payments?.length || 0} unpaid payments to process`)

    // Process each payment
    for (const payment of payments || []) {
      try {
        const dueDate = new Date(payment.due_date)
        let reminderType = null
        let shouldSend = false
        let updateField = null

        console.log(`Processing payment ${payment.id}: due_date=${payment.due_date}, dueDate=${dueDate.toDateString()}, today=${today.toDateString()}, tomorrow=${tomorrow.toDateString()}, reminderDate=${reminderDate.toDateString()}`)

        // Check CUSTOM REMINDER DAYS based on user settings
        if (dueDate.toDateString() === reminderDate.toDateString() && (!automatic || !payment.last_reminder_sent)) {
          reminderType = 'custom_reminder'
          shouldSend = true
          updateField = 'last_reminder_sent'
          upcoming_72h++ // Reuse counter for custom reminders
        }
        // Check 24 HOURS REMINDER
        else if (dueDate.toDateString() === tomorrow.toDateString() && (!automatic || !payment.last_24h_reminder_sent)) {
          reminderType = '24_hours'
          shouldSend = true
          updateField = 'last_24h_reminder_sent'
          upcoming_24h++
        }
        // Check OVERDUE REMINDER
        else if (dueDate < today && (!automatic || !payment.last_overdue_reminder_sent)) {
          reminderType = 'overdue'
          shouldSend = true
          updateField = 'last_overdue_reminder_sent'
          overdue++
        }

        if (!shouldSend) {
          skipped++
          console.log(`Payment ${payment.id} skipped - no reminder needed or already sent. Reminder type: ${reminderType}, shouldSend: ${shouldSend}`)
          continue
        }

        console.log(`Processing ${reminderType} reminder for payment ${payment.id}`)

        // Get responsible employee info for email
        let recipientEmail = null
        let recipientName = null
        if (payment.responsible_user_id) {
          console.log(`Fetching profile for user_id: ${payment.responsible_user_id}`)
          
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
          
          console.log(`User result:`, { userData, userError })
          
          if (userError || !userData?.user?.email) {
            console.error('Error fetching user email:', userError)
            skipped++
            console.log(`Payment ${payment.id} skipped - error fetching responsible person email`)
            continue
          }
          
          recipientEmail = userData.user.email
          
          console.log(`Final data:`, { recipientName, recipientEmail })
        }

        if (!recipientEmail) {
          skipped++
          console.log(`Payment ${payment.id} skipped - no responsible person email found for user_id: ${payment.responsible_user_id}`)
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
              reminderType,
              responsibleName: recipientName,
              appUrl
            })

            const subject = getSubject(reminderType, payment.client_name)

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

            const result = await response.json()
            console.log(`Email sent successfully for payment ${payment.id}:`, result.id)

          } catch (emailError) {
            console.error('Email error:', emailError)
            continue
          }
        } else {
          console.log(`DRY RUN: Would send ${reminderType} email for payment ${payment.id}`)
        }

        // Update payment record with reminder timestamp
        const updateData = {
          [updateField]: now.toISOString(),
          updated_at: now.toISOString()
        }

        const { error: updateError } = await supabase
          .from('client_payments')
          .update(updateData)
          .eq('id', payment.id)

        if (updateError) {
          console.error('Error updating payment:', updateError)
          continue
        }

        sent++
        console.log(`Successfully processed ${reminderType} reminder for payment ${payment.id}`)

      } catch (error) {
        console.error(`Error processing payment ${payment.id}:`, error)
      }
    }

    const result = {
      success: true,
      sent,
      skipped,
      overdue,
      upcoming_72h,
      upcoming_24h
    }

    console.log('Payment reminders completed:', result)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in payment reminders function:', error)
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

function getSubject(reminderType: string, clientName: string): string {
  const name = clientName || 'Valued Client'
  
  switch (reminderType) {
    case 'overdue':
      return `Action Required: Overdue Payment Collection - ${name}`
    case '24_hours':
      return `Urgent: Payment Collection Due Tomorrow - ${name}`
    case 'custom_reminder':
      return `Reminder: Payment Collection Due - ${name}`
    default:
      return `Payment Collection Reminder - ${name}`
  }
}

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
  
  const urgencyColors = {
    overdue: '#dc2626',
    '24_hours': '#f59e0b',
    custom_reminder: '#3b82f6'
  }
  
  const urgencyMessages = {
    overdue: 'Payment collection is now overdue. Please contact the client immediately to collect the payment.',
    '24_hours': 'Payment collection is due tomorrow. Please ensure you collect the payment on time.',
    custom_reminder: 'This is a reminder to collect payment according to your configured schedule.',
  }
  
  const color = urgencyColors[reminderType as keyof typeof urgencyColors] || '#3b82f6'
  const message = urgencyMessages[reminderType as keyof typeof urgencyMessages] || urgencyMessages['custom_reminder']
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${color}; }
        .amount { font-size: 24px; font-weight: bold; color: ${color}; }
        .due-date { font-size: 18px; font-weight: bold; color: #059669; }
        .overdue { color: #dc2626; font-weight: bold; }
        .button { display: inline-block; padding: 12px 24px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Payment Collection Reminder</h1>
          ${reminderType === 'overdue' ? '<p>URGENT - COLLECTION OVERDUE</p>' : ''}
        </div>
        <div class="content">
          <p>Hi ${responsibleName || 'Team Member'},</p>
          <p>This is a reminder to collect payment from <strong>${clientName}</strong>.</p>
          <p>${message}</p>
          
          <div class="payment-details">
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Invoice Amount:</strong> ₹${invoiceAmount.toFixed(2)}</p>
            <p><strong>Amount Paid:</strong> ₹${amountPaid.toFixed(2)}</p>
            <p class="amount"><strong>Balance to Collect:</strong> ₹${balance.toFixed(2)}</p>
            <p class="due-date ${reminderType === 'overdue' ? 'overdue' : ''}">
              <strong>Collection Due Date:</strong> ${due.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            ${reminderType === 'overdue' ? `<p class="overdue">COLLECTION OVERDUE BY ${Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))} days</p>` : ''}
          </div>
          
          <p>Please contact the client to arrange payment collection as soon as possible.</p>
          
          <p>To view payment details and update status:</p>
          <a href="${appUrl}" class="button">View Payment Details</a>
          
          <p>If you have already collected this payment, please update the payment status in the system.</p>
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
