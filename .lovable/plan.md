

## Plan: Unified "Medewerker toevoegen" dialog

### Idee

Vervang de dropdown met twee opties door één simpele knop **"+ Medewerker toevoegen"** die een dialog opent. In die dialog kiest de admin eerst het **type** (twee kaarten/opties), en dan volgt het bijbehorende formulier.

### Flow

```text
[+ Medewerker toevoegen]
        ↓
┌─────────────────────────────────┐
│  Medewerker toevoegen           │
│                                 │
│  ┌─────────────┐ ┌────────────┐ │
│  │ 📧 Met      │ │ 🔑 Kassa   │ │
│  │ e-mail      │ │ met PIN    │ │
│  │ (uitnodig.) │ │ (geen acc.)│ │
│  └─────────────┘ └────────────┘ │
│                                 │
│  [Stap 2: formuliervelden]      │
└─────────────────────────────────┘
```

### Wijzigingen

**`src/components/admin/settings/TeamSettings.tsx`**
- Dropdown + `ChevronDown` weg → gewone `Button` "Medewerker toevoegen"
- Knop opent een nieuwe unified `AddTeamMemberDialog`

**Nieuw: `src/components/admin/settings/AddTeamMemberDialog.tsx`**
- Stap 1: twee klikbare kaarten — "Met e-mail" (uitnodiging) of "Kassamedewerker" (PIN)
- Stap 2a (e-mail): e-mailadres + rol selectie → uitnodiging versturen (hergebruikt `useTeamInvitations`)
- Stap 2b (kassa): naam + PIN + kleur → aanmaken (hergebruikt `usePOSCashiers`)
- Eén dialog, twee paden, minimale complexiteit

**`src/components/admin/settings/InviteTeamMemberDialog.tsx`**
- Blijft bestaan voor eventueel standalone gebruik, maar wordt niet meer direct aangeroepen vanuit TeamSettings

| Bestand | Actie |
|---------|-------|
| `src/components/admin/settings/AddTeamMemberDialog.tsx` | Nieuw — unified dialog met type-selectie |
| `src/components/admin/settings/TeamSettings.tsx` | Vereenvoudig knop, gebruik nieuwe dialog |

