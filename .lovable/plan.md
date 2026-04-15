

# Plan: Enable return cancellation

## Problem
The ReturnDetail page has no "Annuleren" (cancel) button. Only the Returns list has one hidden in a dropdown menu. The user needs to be able to cancel returns from the detail page.

## Changes

### 1. Add cancel button to ReturnDetail.tsx header area (~line 206)
Add a destructive "Retour annuleren" button in the header next to the RMA number, visible when the return is not already cancelled/closed/completed. Clicking it shows a confirmation AlertDialog (to prevent accidental cancellation).

- Add state: `showCancelDialog`
- Button: red outline, with XCircle icon, positioned in the header actions area
- AlertDialog: "Weet je zeker dat je deze retour wilt annuleren?" with confirm/cancel
- On confirm: calls `updateReturnStatus.mutate({ returnId, status: 'cancelled' })`

### 2. Verify list page cancel still works
The Returns.tsx list page already has cancel in the dropdown — no changes needed there. Just ensure the mutation works (it uses the same `updateReturnStatus`).

### 3. Handle cancelled state in detail UI
When status is `cancelled`, both the logistics and financial panels should show a disabled/greyed state with no action buttons. This already works because the action buttons are gated on specific statuses, but we should add a visible "Geannuleerd" indicator.

## Technical details

**ReturnDetail.tsx changes:**
- Add `showCancelDialog` state
- Add cancel button in header (line ~206), conditionally rendered when `!['cancelled','closed','completed'].includes(returnRecord.status)`
- Add AlertDialog for confirmation
- No hook changes needed — `updateReturnStatus` already supports `cancelled` as a valid `ReturnStatus`

