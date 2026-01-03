# Edge Function Configuration Instructions

## Required Environment Variables

Add these secrets to your Supabase project:

### 1. Go to Supabase Dashboard
### 2. Navigate to Edge Functions
### 3. Click on your function (send-payment-reminders)
### 4. Go to "Secrets" tab
### 5. Add the following secrets:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
RESEND_API_KEY=re_your_api_key_here
```

## Alternative: Use SUPABASE_SERVICE_ROLE_KEY

If you prefer to use the service role key instead of anon key:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
RESEND_API_KEY=re_your_api_key_here
```

## Where to find these values:

### SUPABASE_URL:
- Go to Supabase Dashboard → Project Settings → API
- Copy the "Project URL" 

### SUPABASE_ANON_KEY:
- Go to Supabase Dashboard → Project Settings → API  
- Copy the "anon public" key

### SUPABASE_SERVICE_ROLE_KEY (alternative):
- Go to Supabase Dashboard → Authentication → Settings
- Or generate a new service role key in API settings

### RESEND_API_KEY:
- Go to Resend Dashboard → API Keys
- Create a new API key
- Copy the key

## After Adding Secrets:

1. Redeploy the Edge Function
2. The function will now properly initialize Supabase client
3. Email sending should work correctly
4. Function will return HTTP 200 on success

## Testing:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-payment-reminders
```

## Error Messages Fixed:

- ❌ "Missing Supabase configuration" → ✅ "Missing SUPABASE_URL in Edge Function secrets"
- ❌ "Missing SUPABASE_SERVICE_ROLE_KEY" → ✅ "Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY"  
- ❌ Generic error → ✅ Specific error messages for each missing variable

## Current Function Status:

The Edge Function now:
- ✅ Checks for all required environment variables
- ✅ Provides explicit error messages
- ✅ Supports both ANON_KEY and SERVICE_ROLE_KEY
- ✅ Logs successful environment loading
- ✅ Handles missing configuration gracefully
