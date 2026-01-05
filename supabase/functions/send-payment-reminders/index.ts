import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentReminderSummary {
  sent: number
  skipped: number
  errors: number
  details: {
    sent: Array<{ paymentId: string; email: string; type: string }>
    skipped: Array<{ paymentId: string; reason: string }>
    errors: Array<{ paymentId: string; error: string }>
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Payment reminders function started')
    
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'https://your-app-url.com'
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasResendKey: !!resendApiKey,
      appUrl
    })

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured - will run in dry run mode')
    }

    // Get current date and time
    const now = new Date()
    const now72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    const now24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    console.log('Time thresholds:', {
      now: now.toISOString(),
      now72Hours: now72Hours.toISOString(),
      now24Hours: now24Hours.toISOString()
    })

    // Fetch payments that need reminders
    const { data: payments, error: fetchError } = await supabase
      .from('client_payments')
      .select(`
        id,
        client_id,
        amount,
        due_date,
        status,
        last_reminder_sent,
        reminder_count,
        clients (
          id,
          name,
          email,
          company_name
        )
      `)
      .in('status', ['pending', 'overdue'])
      .or(`due_date.lte.${now72Hours.toISOString()},due_date.lte.${now24Hours.toISOString()},due_date.lt.${now.toISOString()}`)
      .order('due_date', { ascending: true })

    if (fetchError) {
      console.error('Error fetching payments:', fetchError)
      throw new Error(`Failed to fetch payments: ${fetchError.message}`)
    }

    console.log(`Found ${payments?.length || 0} payments to process`)

    const summary: PaymentReminderSummary = {
      sent: 0,
      skipped: 0,
      errors: 0,
      details: {
        sent: [],
        skipped: [],
        errors: []
      }
    }

    // Process each payment
    for (const payment of payments || []) {
      try {
        const reminderType = getReminderType(payment.due_date, now, now24Hours, now72Hours)
        
        if (!reminderType) {
          summary.skipped++
          summary.details.skipped.push({
            paymentId: payment.id,
            reason: 'No reminder needed'
          })
          continue
        }

        // Check if already reminded recently
        if (payment.last_reminder_sent) {
          const lastReminder = new Date(payment.last_reminder_sent)
          const hoursSinceReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60)
          
          // Don't send more than one reminder per 24 hours
          if (hoursSinceReminder < 24) {
            summary.skipped++
            summary.details.skipped.push({
              paymentId: payment.id,
              reason: `Already reminded ${hoursSinceReminder.toFixed(1)} hours ago`
            })
            continue
          }
        }

        // Send reminder
        const client = payment.clients
        if (!client || !client.email) {
          summary.skipped++
          summary.details.skipped.push({
            paymentId: payment.id,
            reason: 'No client email found'
          })
          continue
        }

        const emailHtml = generatePaymentReminderEmail({
          clientName: client.name || client.company_name || 'Valued Client',
          amount: payment.amount,
          dueDate: payment.due_date,
          reminderType,
          appUrl,
          paymentId: payment.id
        })

        if (resendApiKey) {
          // Send real email
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'EWPM System <noreply@ewpm.system>',
              to: [client.email],
              subject: getSubject(reminderType, client.name || client.company_name),
              html: emailHtml,
            }),
          })

          if (!response.ok) {
            const error = await response.text()
            throw new Error(`Email service error: ${error}`)
          }

          const result = await response.json()
          console.log(`Email sent successfully for payment ${payment.id}:`, result.id)
        } else {
          // Dry run mode
          console.log(`DRY RUN: Would send email to ${client.email} for payment ${payment.id}`)
        }

        // Update payment record
        const { error: updateError } = await supabase
          .from('client_payments')
          .update({
            last_reminder_sent: now.toISOString(),
            reminder_count: (payment.reminder_count || 0) + 1,
            updated_at: now.toISOString()
          })
          .eq('id', payment.id)

        if (updateError) {
          console.error('Error updating payment:', updateError)
          throw new Error(`Failed to update payment: ${updateError.message}`)
        }

        summary.sent++
        summary.details.sent.push({
          paymentId: payment.id,
          email: client.email,
          type: reminderType
        })

      } catch (error) {
        console.error(`Error processing payment ${payment.id}:`, error)
        summary.errors++
        summary.details.errors.push({
          paymentId: payment.id,
          error: error.message
        })
      }
    }

    console.log('Payment reminders completed:', summary)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment reminders processed',
        summary,
        timestamp: now.toISOString(),
        dryRun: !resendApiKey
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in payment reminders function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getReminderType(dueDate: string, now: Date, now24Hours: Date, now72Hours: Date): string | null {
  const due = new Date(dueDate)
  
  if (due < now) {
    return 'overdue'
  } else if (due <= now24Hours) {
    return 'due_24_hours'
  } else if (due <= now72Hours) {
    return 'due_72_hours'
  }
  
  return null
}

function getSubject(reminderType: string, clientName: string): string {
  const name = clientName || 'Valued Client'
  
  switch (reminderType) {
    case 'overdue':
      return `URGENT: Payment Overdue - ${name}`
    case 'due_24_hours':
      return `Payment Due Tomorrow - ${name}`
    case 'due_72_hours':
      return `Payment Reminder - ${name}`
    default:
      return `Payment Reminder - ${name}`
  }
}

function generatePaymentReminderEmail(data: {
  clientName: string
  amount: number
  dueDate: string
  reminderType: string
  appUrl: string
  paymentId: string
}): string {
  const { clientName, amount, dueDate, reminderType, appUrl, paymentId } = data
  const due = new Date(dueDate)
  
  const urgencyColors = {
    overdue: '#dc2626',
    due_24_hours: '#f59e0b',
    due_72_hours: '#3b82f6'
  }
  
  const urgencyMessages = {
    overdue: 'Your payment is now overdue. Please make your payment as soon as possible to avoid additional fees.',
    due_24_hours: 'Your payment is due tomorrow. Please ensure your payment is made on time.',
    due_72_hours: 'This is a friendly reminder that your payment is due in the next 72 hours.'
  }
  
  const color = urgencyColors[reminderType as keyof typeof urgencyColors] || '#3b82f6'
  const message = urgencyMessages[reminderType as keyof typeof urgencyMessages] || urgencyMessages.due_72_hours
  
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
            <p class="amount">Amount: $${amount.toFixed(2)}</p>
            <p class="due-date ${reminderType === 'overdue' ? 'overdue' : ''}">
              Due Date: ${due.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            ${reminderType === 'overdue' ? `<p class="overdue">OVERDUE BY ${Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))} days</p>` : ''}
          </div>
          
          <p>If you have already made this payment, please disregard this reminder.</p>
          
          <p>To view your payment details or make a payment online:</p>
          <a href="${appUrl}/payments/${paymentId}" class="button">View Payment Details</a>
          
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
