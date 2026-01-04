import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentReminderRequest {
  paymentId: string
  recipientEmail: string
  recipientName: string
  amount: number
  dueDate: string
  clientName?: string
  projectName?: string
  customMessage?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method } = req
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from auth
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (method === 'POST') {
      const body = await req.json()
      
      if (body.type === 'payment_reminder') {
        return await handlePaymentReminder(body, supabaseClient, user)
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid request type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in payment reminder function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handlePaymentReminder(
  request: any,
  supabaseClient: any,
  user: any
) {
  const { paymentId, recipientEmail, recipientName, amount, dueDate, clientName, projectName, customMessage } = request

  if (!paymentId || !recipientEmail || !recipientName || !amount || !dueDate) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: paymentId, recipientEmail, recipientName, amount, dueDate' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Generate payment reminder email
  const subject = `Payment Reminder - ${projectName || 'Payment Due'}`
  const htmlContent = generatePaymentReminderEmail({
    recipientName,
    amount,
    dueDate,
    clientName,
    projectName,
    customMessage
  })
  const textContent = generatePaymentReminderText({
    recipientName,
    amount,
    dueDate,
    clientName,
    projectName,
    customMessage
  })

  return await sendEmail({
    to: recipientEmail,
    subject,
    html: htmlContent,
    text: textContent,
    from: 'EWPM System <noreply@ewpm.system>',
    replyTo: user.email
  })
}

async function sendEmail(emailData: {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
}) {
  // For development, we'll use Resend (you can replace with your preferred email service)
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  
  if (!resendApiKey) {
    console.log('Email service not configured - logging payment reminder:', emailData)
    return new Response(
      JSON.stringify({ 
        message: 'Payment reminder logged (email service not configured)',
        email: emailData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailData.from || 'EWPM System <noreply@ewpm.system>',
        to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
        subject: emailData.subject,
        html: emailData.html || emailData.text,
        text: emailData.text,
        reply_to: emailData.replyTo,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Email service error: ${error}`)
    }

    const result = await response.json()
    
    return new Response(
      JSON.stringify({ 
        message: 'Payment reminder sent successfully',
        id: result.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Failed to send payment reminder:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

function generatePaymentReminderEmail(data: {
  recipientName: string
  amount: number
  dueDate: string
  clientName?: string
  projectName?: string
  customMessage?: string
}) {
  const { recipientName, amount, dueDate, clientName, projectName, customMessage } = data

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
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💳 Payment Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${recipientName},</p>
          <p>This is a friendly reminder that you have a payment due:</p>
          
          <div class="payment-details">
            ${projectName ? `<h3>${projectName}</h3>` : ''}
            ${clientName ? `<p><strong>Client:</strong> ${clientName}</p>` : ''}
            <p class="amount">Amount: $${amount.toFixed(2)}</p>
            <p class="due-date">Due Date: ${new Date(dueDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          
          ${customMessage ? `<p>${customMessage}</p>` : ''}
          
          <p>Please ensure your payment is made on time to avoid any late fees or service interruptions.</p>
          
          <p>If you have already made this payment, please disregard this reminder.</p>
          
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

function generatePaymentReminderText(data: {
  recipientName: string
  amount: number
  dueDate: string
  clientName?: string
  projectName?: string
  customMessage?: string
}) {
  const { recipientName, amount, dueDate, clientName, projectName, customMessage } = data

  return `
Hi ${recipientName},

💳 PAYMENT REMINDER

This is a friendly reminder that you have a payment due:

${projectName ? `Project: ${projectName}` : ''}
${clientName ? `Client: ${clientName}` : ''}
Amount: $${amount.toFixed(2)}
Due Date: ${new Date(dueDate).toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}

${customMessage ? `\n${customMessage}` : ''}

Please ensure your payment is made on time to avoid any late fees or service interruptions.

If you have already made this payment, please disregard this reminder.

If you have any questions or need to arrange a payment plan, please don't hesitate to contact us.

Best regards,
EWPM System

---
This email was sent by EWPM System
If you no longer wish to receive these reminders, please contact us.
  `
}
