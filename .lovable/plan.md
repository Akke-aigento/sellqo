# Plan: fix the Bol VVB recrop width assumption

## Goal
Make recropped Bol/bpost labels render fully on Dymo 4XL labels so the barcode and right-hand info column are no longer cut off.

## What I’ll change
1. Update the `create-bol-vvb-label` function so it no longer assumes the usable source label area is capped at A5 width (`420 pt`).
2. Replace that fixed source extraction with a wider or source-aware capture area, then scale that full content into the Dymo 4XL page.
3. Keep the current recrop button/UI as-is, since it is already correctly triggering the backend flow.
4. Re-run recrop for the affected VanXcel labels and verify the output visually.

## Why this should fix it
The current recrop flow is working, but it still extracts only the first `420 pt` of the source PDF before scaling. Your uploaded result proves the right side is already missing before scaling happens. So the real fix is in the backend PDF extraction logic, not in SQL or the UI.

## Validation
- Confirm the regenerated PDF still has Dymo 4XL page size (`289 x 595 pt`)
- Confirm the barcode is fully visible
- Confirm the right-hand top section is fully visible
- Confirm the same fix works for both orders `#1144` and `#1145`

## Technical details
- File: `supabase/functions/create-bol-vvb-label/index.ts`
- Likely change area: `cropToLabel()`
- Current problematic assumption:
  ```ts
  const A5_W = 420;
  const contentW = Math.min(srcW, A5_W);
  ```
- Planned direction: use the real source width or a better bounded extraction window, then scale-to-fit into `dymo_lw_4xl`
- After that, test the deployed function by recropping the affected labels and checking the resulting PDFs visually.