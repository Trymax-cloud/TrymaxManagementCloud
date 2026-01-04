# Payment Reminder Edge Function Deployment

## 🚀 Quick Deployment

### 1. Set Up Environment Variables

In your Supabase project dashboard, set these environment variables:

```bash
# Email Service (Resend recommended)
RESEND_API_KEY=your_resend_api_key_here

# Supabase (automatically set)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Deploy the Function

```bash
# Navigate to your project root
cd d:\TrymaxManagement\TrymaxManagement

# Deploy the payment reminder function
supabase functions deploy send-payment-reminder

# Or deploy all functions
supabase functions deploy
```

### 3. Test the Function

```bash
# Test locally first
supabase functions serve send-payment-reminder

# Then test deployed function
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/send-payment-reminder' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "payment_reminder",
    "paymentId": "payment_123",
    "recipientEmail": "client@example.com",
    "recipientName": "John Doe",
    "amount": 1500.00,
    "dueDate": "2026-01-15",
    "clientName": "ABC Company",
    "projectName": "Website Redesign",
    "customMessage": "Please ensure payment is made on time to avoid late fees."
  }'
```

## 📧 Email Service Setup

### Option 1: Resend (Recommended)
1. Sign up at [Resend.com](https://resend.com)
2. Get your API key from dashboard
3. Set `RESEND_API_KEY` environment variable
4. Verify your sending domain

### Option 2: Other Email Services
Replace the email sending logic in `index.ts` with your preferred service (SendGrid, Mailgun, etc.)

## 🔧 Frontend Integration

### Usage in React Components

```tsx
import { useSendPaymentReminder } from '@/hooks/useSendPaymentReminder';

function PaymentReminderButton({ payment }: { payment: any }) {
  const sendReminder = useSendPaymentReminder();

  const handleSendReminder = () => {
    sendReminder.mutate({
      paymentId: payment.id,
      recipientEmail: payment.client_email,
      recipientName: payment.client_name,
      amount: payment.amount,
      dueDate: payment.due_date,
      clientName: payment.client_name,
      projectName: payment.project_name,
      customMessage: "This is a friendly reminder about your upcoming payment."
    });
  };

  return (
    <button 
      onClick={handleSendReminder}
      disabled={sendReminder.isPending}
    >
      {sendReminder.isPending ? 'Sending...' : 'Send Payment Reminder'}
    </button>
  );
}
```

## 🎯 Features

### ✅ What's Included
- **Professional HTML email templates**
- **Text-only email fallback**
- **Payment amount formatting**
- **Due date formatting**
- **Custom message support**
- **Client and project details**
- **Error handling and logging**
- **TypeScript support**

### 📧 Email Template Features
- **Responsive design**
- **Professional styling**
- **Clear payment details**
- **Call-to-action elements**
- **Contact information**
- **Unsubscribe notice**

## 🔍 Monitoring

### Check Function Logs
```bash
# View function logs
supabase functions logs send-payment-reminder

# Real-time logs
supabase functions logs send-payment-reminder --follow
```

### Monitor Email Delivery
Check your email service dashboard (Resend, SendGrid, etc.) for:
- Delivery status
- Open rates
- Click rates
- Bounces
- Spam complaints

## 🛠️ Customization

### Modify Email Templates
Edit the `generatePaymentReminderEmail()` and `generatePaymentReminderText()` functions in `index.ts` to customize:
- Colors and styling
- Logo and branding
- Additional payment details
- Custom messaging
- Footer information

### Add New Email Types
Extend the function to handle other email types:
- Invoice notifications
- Payment confirmations
- Late payment notices
- Welcome emails

## 🔒 Security

### Authentication
- Function requires valid Supabase auth token
- User must be authenticated to send emails
- Email addresses are validated

### Rate Limiting
Consider implementing rate limiting in production:
- Maximum emails per user per day
- Maximum emails per hour
- Duplicate email prevention

## 📋 Troubleshooting

### Common Issues

**Function not found:**
```bash
# Ensure function is deployed
supabase functions deploy send-payment-reminder
```

**Email not sending:**
```bash
# Check environment variables
supabase secrets list

# Check function logs
supabase functions logs send-payment-reminder
```

**CORS errors:**
- Ensure frontend is using correct Supabase URL
- Check CORS headers in function

**Authentication errors:**
- Ensure user is logged in
- Check Supabase auth configuration

## 🚀 Production Checklist

- [ ] Set up email service (Resend/SendGrid)
- [ ] Configure environment variables
- [ ] Deploy function to production
- [ ] Test with real email addresses
- [ ] Set up monitoring and alerts
- [ ] Configure rate limiting
- [ ] Test error handling
- [ ] Verify email templates display correctly
- [ ] Set up analytics tracking
