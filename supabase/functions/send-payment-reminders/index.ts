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
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appUrl = Deno.env.get('APP_URL')
    
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
    const now72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    const now24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    console.log('Time thresholds:', {
      now: now.toISOString(),
      now72Hours: now72Hours.toISOString(),
      now24Hours: now24Hours.toISOString()
    })

    // Simple query first - just get basic payments
    const { data: payments, error: fetchError } = await supabase
      .from('client_payments')
      .select('*')
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })

    if (fetchError) {
      console.error('Error fetching payments:', fetchError)
      throw new Error(`Failed to fetch payments: ${fetchError.message}`)
    }

    console.log(`Found ${payments?.length || 0} payments to process`)

    const summary = {
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
        const due = new Date(payment.due_date)
        let reminderType = null
        
        if (due < now) {
          reminderType = 'overdue'
        } else if (due <= now24Hours) {
          reminderType = 'due_24_hours'
        } else if (due <= now72Hours) {
          reminderType = 'due_72_hours'
        }
        
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
          
          if (hoursSinceReminder < 24) {
            summary.skipped++
            summary.details.skipped.push({
              paymentId: payment.id,
              reason: `Already reminded ${hoursSinceReminder.toFixed(1)} hours ago`
            })
            continue
          }
        }

        // Get client info
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', payment.client_id)
          .single()

        if (clientError || !client) {
          summary.skipped++
          summary.details.skipped.push({
            paymentId: payment.id,
            reason: 'No client found'
          })
          continue
        }

        if (!client.email) {
          summary.skipped++
          summary.details.skipped.push({
            paymentId: payment.id,
            reason: 'No client email'
          })
          continue
        }

        // Send email if API key available
        if (resendApiKey) {
          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'EWPM System <noreply@ewpm.system>',
                to: [client.email],
                subject: `Payment Reminder - ${reminderType.replace('_', ' ').toUpperCase()}`,
                html: generateSimpleEmail(client.name || client.company_name, payment.amount, payment.due_date, reminderType),
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
            summary.errors++
            summary.details.errors.push({
              paymentId: payment.id,
              error: emailError.message
            })
            continue
          }
        } else {
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
          summary.errors++
          summary.details.errors.push({
            paymentId: payment.id,
            error: updateError.message
          })
          continue
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

function generateSimpleEmail(clientName: string, amount: number, dueDate: string, reminderType: string): string {
  const name = clientName || 'Valued Client'
  const due = new Date(dueDate)
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
        .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
        .due-date { font-size: 18px; font-weight: bold; color: #059669; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💳 Payment Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>This is a reminder that you have a payment due:</p>
          
          <div class="payment-details">
            <p class="amount">Amount: $${amount.toFixed(2)}</p>
            <p class="due-date">Due Date: ${due.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          
          <p>Please ensure your payment is made on time.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
