# Plan: fix pending team invitations that still don’t show up

## What I’ll change
1. Add a small backend helper function that reads the signed-in user’s email safely from `public.profiles` instead of querying the protected auth table inside RLS.
2. Replace the broken `team_invitations` read policy that currently references `auth.users`, which is causing the 403 and blocking the pending-invitations list.
3. Keep the existing admin invitation policy intact so tenant admins can still manage invitations for their own shop.
4. Re-test the invitation flow so the pending invite list can load immediately after sending.

## Expected result
- Sending an invitation still works.
- The pending invitation appears in the team/invitations list.
- The repeated 403 `permission denied for table users` error disappears.

## Technical details
- Current root cause: active policy `Users can view their own invitations` on `public.team_invitations` contains:
  ```sql
  SELECT users.email FROM auth.users WHERE users.id = auth.uid()
  ```
  That lookup is not allowed for normal client requests, so the whole `team_invitations` read fails with a 42501/403.
- Safer replacement:
  - create a `SECURITY DEFINER` helper in `public` that returns the current user email from `public.profiles`
  - update the invitation policy to compare against that helper instead of `auth.users`
- No frontend redesign needed unless a second issue appears after the policy fix.

## Files / areas involved
- New database migration for the `team_invitations` policy fix
- Then validation against the existing hook `src/hooks/useTeamInvitations.ts`

## Validation
- Check active policies after migration
- Verify the pending invite row is readable again for the signed-in admin
- Confirm no new auth or RLS regressions in the invitation flow