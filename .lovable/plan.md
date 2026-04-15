

# Plan: Add "Inspectie vereist voor refund" toggle to Return Settings

## Problem
ReturnDetail.tsx references `refund_requires_inspection` and even tells the user to go to "Instellingen → Retouren → Inspectie vereist voor refund" to change it — but that toggle doesn't exist in the settings UI.

## Fix

**One file change: `src/components/admin/settings/ReturnSettings.tsx`**

Add a Switch toggle after line 222 (after "Gedeeltelijke refunds toestaan") in the "Refund logica" accordion section:

```
<div className="flex items-center justify-between">
  <div>
    <Label>Inspectie vereist voor refund</Label>
    <p className="text-xs text-muted-foreground">
      Wanneer uitgeschakeld kan een refund worden verwerkt zonder dat de inspectie is afgerond.
    </p>
  </div>
  <Switch
    checked={settings.refund_requires_inspection}
    onCheckedChange={v => handleSwitch('refund_requires_inspection', v)}
  />
</div>
```

No DB migration needed — the column already exists in `tenant_return_settings` and the hook already includes it.

