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
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) // Today + 3 days
    
    console.log('Date calculations:', {
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      threeDaysFromNow: threeDaysFromNow.toISOString()
    })

    // Initialize counters
    let sent = 0
    let skipped = 0
    let overdue = 0
    let upcoming_72h = 0
    let upcoming_24h = 0
    const errors = []

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
        let updateValue = null

        // Check 72 HOURS REMINDER
        if (dueDate.toDateString() === threeDaysFromNow.toDateString() && !payment.remarks?.includes('72h_reminder_sent')) {
          reminderType = '72_hours'
          shouldSend = true
          updateField = 'remarks'
          updateValue = `${payment.remarks || ''} | 72h_reminder_sent: ${now.toISOString()}`
          upcoming_72h++
        }
        // Check 24 HOURS REMINDER
        else if (dueDate.toDateString() === tomorrow.toDateString() && !payment.remarks?.includes('24h_reminder_sent')) {
          reminderType = '24_hours'
          shouldSend = true
          updateField = 'remarks'
          updateValue = `${payment.remarks || ''} | 24h_reminder_sent: ${now.toISOString()}`
          upcoming_24h++
        }
        // Check OVERDUE REMINDER
        else if (dueDate < today && !payment.remarks?.includes('overdue_reminder_sent')) {
          reminderType = 'overdue'
          shouldSend = true
          updateField = 'remarks'
          updateValue = `${payment.remarks || ''} | overdue_reminder_sent: ${now.toISOString()}`
          overdue++
        }

        if (!shouldSend) {
          skipped++
          console.log(`Payment ${payment.id} skipped - no reminder needed or already sent`)
          continue
        }

        console.log(`Processing ${reminderType} reminder for payment ${payment.id}`)

        // Get responsible employee name if available
        let responsibleName = null
        if (payment.responsible_user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payment.responsible_user_id)
            .single()
          responsibleName = profile?.full_name
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
              responsibleName,
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
                to: ['client@example.com'], // This should be replaced with actual client email
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
            errors.push(`Payment ${payment.id}: ${emailError.message}`)
            continue
          }
        } else {
          console.log(`DRY RUN: Would send ${reminderType} email for payment ${payment.id}`)
        }

        // Update payment record with reminder timestamp
        const updateData = {
          [updateField]: updateValue,
          updated_at: now.toISOString()
        }

        const { error: updateError } = await supabase
          .from('client_payments')
          .update(updateData)
          .eq('id', payment.id)

        if (updateError) {
          console.error('Error updating payment:', updateError)
          errors.push(`Payment ${payment.id}: ${updateError.message}`)
          continue
        }

        sent++
        console.log(`Successfully processed ${reminderType} reminder for payment ${payment.id}`)

      } catch (error) {
        console.error(`Error processing payment ${payment.id}:`, error)
        errors.push(`Payment ${payment.id}: ${error.message}`)
      }
    }

    const result = {
      success: true,
      sent,
      skipped,
      overdue,
      upcoming_72h,
      upcoming_24h,
      errors
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
        upcoming_24h: 0,
        errors: [error.message]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getSubject(reminderType: string, clientName: string): string {
  const name = clientName || 'Valued Client'
  
  switch (reminderType) {
    case 'overdue':
      return `Overdue Payment Reminder - ${name}`
    case '24_hours':
      return `Urgent: Payment due tomorrow - ${name}`
    case '72_hours':
      return `Payment Reminder: Invoice due in 72 hours - ${name}`
    default:
      return `Payment Reminder - ${name}`
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
    '72_hours': '#3b82f6'
  }
  
  const urgencyMessages = {
    overdue: 'Your payment is now overdue. Please make your payment as soon as possible.',
    '24_hours': 'Your payment is due tomorrow. Please ensure your payment is made on time.',
    '72_hours': 'This is a friendly reminder that your payment is due in 72 hours.'
  }
  
  const color = urgencyColors[reminderType as keyof typeof urgencyColors] || '#3b82f6'
  const message = urgencyMessages[reminderType as keyof typeof urgencyMessages] || urgencyMessages['72_hours']
  
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
          <h1>💳 Payment Reminder</h1>
          ${reminderType === 'overdue' ? '<p>URGENT - PAYMENT OVERDUE</p>' : ''}
        </div>
        <div class="content">
          <p>Hi ${clientName},</p>
          <p>${message}</p>
          
          <div class="payment-details">
            <p><strong>Invoice Amount:</strong> $${invoiceAmount.toFixed(2)}</p>
            <p><strong>Amount Paid:</strong> $${amountPaid.toFixed(2)}</p>
            <p class="amount"><strong>Balance Due:</strong> $${balance.toFixed(2)}</p>
            <p class="due-date ${reminderType === 'overdue' ? 'overdue' : ''}">
              <strong>Due Date:</strong> ${due.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            ${reminderType === 'overdue' ? `<p class="overdue">OVERDUE BY ${Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24))} days</p>` : ''}
            ${responsibleName ? `<p><strong>Responsible:</strong> ${responsibleName}</p>` : ''}
          </div>
          
          <p>If you have already made this payment, please disregard this reminder.</p>
          
          <p>To view your payment details or make a payment online:</p>
          <a href="${appUrl}" class="button">View Payment Details</a>
          
          <p>If you have any questions or need to arrange a payment plan, please don't hesitate to contact us.</p>
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
