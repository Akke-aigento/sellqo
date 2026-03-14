

## Problem

Orders stay on "Verzonden" (shipped) and never automatically update to "Afgeleverd" (delivered) because:

1. **No tracking settings exist** — The `tenant_tracking_settings` table is completely empty. The `poll-tracking-status` cron job runs every 30 minutes but immediately exits with "No tenants to poll" because it queries for `auto_poll_17track = true` and finds nothing.

2. **The setting defaults to `false`** — Even when a row is created via the UI, `auto_poll_17track` defaults to `false`, so users must manually enable it.

## Fix

Two changes are needed:

### 1. Insert tracking settings for existing tenants (data fix)
Insert a row into `tenant_tracking_settings` for VanXcel (and other active tenants) with `auto_poll_17track = true` so the cron job starts polling immediately.

### 2. Auto-create settings for new tenants
Add logic so that when a tenant is created or when the tracking settings page is loaded for the first time, a default row is inserted with `auto_poll_17track = true` (enabled by default). This ensures new tenants also get automatic tracking updates without manual configuration.

### 3. Update default in TrackingNotificationSettings.tsx
Change the default value of `auto_poll_17track` from `false` to `true` so the UI shows it as enabled by default for new setups.

| Item | Change |
|---|---|
| Database (data insert) | Insert `tenant_tracking_settings` rows for all existing tenants with `auto_poll_17track = true` |
| `src/components/admin/settings/TrackingNotificationSettings.tsx` | Change default `auto_poll_17track` from `false` to `true`; auto-insert row on first load if none exists |

After this fix, the cron job will find tenants to poll, fetch carrier statuses (PostNL, DHL, bpost, etc.), and automatically update order status from "shipped" → "delivered".

