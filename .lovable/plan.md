

## Plan: Fix Notification Emails Not Being Sent

### Root Cause

The notification email pipeline works correctly end-to-end (trigger fires, edge function runs), but **no emails are sent** because:

1. The UI shows toggle defaults from `NOTIFICATION_CONFIG` (e.g., `defaultEmail: true` for "Nieuwe bestelling"), but these defaults are **never written to the database**. The `tenant_notification_settings` table is completely empty.

2. The `create-notification` edge function checks the DB for settings. When no row exists, the fallback logic is:
   ```typescript
   const shouldSendEmail = settings?.email_enabled ?? (priority === 'urgent' || priority === 'high');
   ```
   Since "Nieuwe bestelling" has `priority: 'medium'`, the fallback evaluates to `false` → no email sent.

### Fix (2 parts)

**Fix 1: Edge function should respect defaults from config**

In `supabase/functions/create-notification/index.ts`, when no settings row exists in the DB, use the same defaults defined in `NOTIFICATION_CONFIG`. Add a hardcoded defaults map for `defaultEmail` per notification type:

```typescript
const DEFAULT_EMAIL_ENABLED: Record<string, boolean> = {
  'order_new': true,
  'order_paid': false,
  'order_payment_failed': true,
  'order_cancelled': true,
  'order_refund_requested': true,
  'order_shipped': false,
  'order_delivered': false,
  'order_high_value': true,
  'marketplace_order_new': true,
  // ... other types from NOTIFICATION_CONFIG
};

const shouldSendEmail = settings?.email_enabled 
  ?? DEFAULT_EMAIL_ENABLED[notification.type] 
  ?? (priority === 'urgent' || priority === 'high');
```

**Fix 2: Initialize settings on first load**

In `src/hooks/useNotificationSettings.ts`, when `fetchSettings` returns an empty array and defaults exist, automatically write the default settings to the database so they persist and the edge function can read them. This way the UI and the backend always agree.

Add an `initializeDefaults` function that bulk-inserts all notification types from `NOTIFICATION_CONFIG` with their default values when no settings exist for the tenant.

### Summary

| Fix | File | Problem | Solution |
|-----|------|---------|----------|
| 1 | create-notification/index.ts | No DB row = no email for medium priority | Use hardcoded defaults matching NOTIFICATION_CONFIG |
| 2 | useNotificationSettings.ts | UI shows defaults but DB is empty | Auto-initialize defaults on first load |

