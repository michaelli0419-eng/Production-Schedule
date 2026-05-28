# Procore Webhook Setup

## 1. Deploy the Edge Function
```
supabase functions deploy procore-webhook --project-ref ixbffxowwvpzzuamvgix
```

## 2. Set environment variables in Supabase Dashboard
Go to Project Settings → Edge Functions → Environment Variables:
- `PROCORE_WEBHOOK_SECRET` — any secret string you choose (put the same value in Procore)

## 3. Configure webhook in Procore
1. Procore → Company Admin → Webhooks → New Webhook
2. URL: `https://ixbffxowwvpzzuamvgix.supabase.co/functions/v1/procore-webhook`
3. Signature Key: the secret you set above
4. Events to subscribe:
   - `Submittals` → `update`, `create`
   - `Daily Logs` → `create`

## 4. Map Procore projects to SCM job numbers
For each Procore project, go to Project Settings → Custom Fields and add:
- Field name: `SCM Job Number`
- Value: the matching job number (e.g. `11661`)

Alternatively, add `procore:PROJECT_ID` anywhere in the job's Notes field in SCM Hub.

## 5. Test
Send a test webhook from Procore → verify activity_log gets a `procore_submittal_sync` entry.
