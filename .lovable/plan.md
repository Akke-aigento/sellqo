

## Plan: Kassa-medewerkers met PIN-code (zonder account)

### Concept

Een nieuw type teamlid: **"Kassa medewerker"** — geen e-mailadres, geen Supabase account, geen uitnodiging. De admin maakt ze rechtstreeks aan met alleen een naam en een 4-cijferige PIN. In de POS selecteert de medewerker zichzelf en voert de PIN in. Simpel.

### Flow

```text
Admin (Instellingen → Team)          POS Terminal
┌─────────────────────────┐     ┌──────────────────────────┐
│ + Kassa medewerker      │     │ Sessie openen            │
│                         │     │ ┌──────────────────────┐ │
│ Naam: [Jan]             │     │ │ Wie ben je?          │ │
│ PIN:  [••••]            │     │ │ ┌────┐ ┌────┐       │ │
│ Kleur: 🔵               │     │ │ │ Jan│ │ Eva│       │ │
│                         │     │ │ └────┘ └────┘       │ │
│ [Opslaan]               │     │ │ PIN: [••••]  [→]    │ │
└─────────────────────────┘     │ └──────────────────────┘ │
                                │                          │
                                │ Tijdens de dag:          │
                                │ [👤 Jan ▾] → Wissel      │
                                └──────────────────────────┘
```

### Database

**Nieuwe tabel: `pos_cashiers`**

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | |
| tenant_id | uuid FK → tenants | |
| display_name | text NOT NULL | Naam op bon/scherm |
| pin_hash | text NOT NULL | Gehashte 4-cijferige PIN |
| avatar_color | text | Kleur voor avatar-cirkel |
| is_active | boolean DEFAULT true | Kan in/uitgeschakeld worden |
| created_at / updated_at | timestamptz | |

RLS: alleen toegankelijk voor tenant_admin/staff van dezelfde tenant. PIN-verificatie via een **database function** (`verify_cashier_pin`) zodat de hash nooit naar de client gaat.

**DB function: `verify_cashier_pin(p_cashier_id uuid, p_pin text)`** — vergelijkt `crypt(p_pin, pin_hash)` en retourneert boolean. Security definer.

**DB function: `hash_cashier_pin(p_pin text)`** — retourneert `crypt(p_pin, gen_salt('bf'))`. Gebruikt bij aanmaken/wijzigen.

**Nieuwe kolom op `pos_transactions`**: `pos_cashier_id uuid NULL FK → pos_cashiers` — naast de bestaande `cashier_id` (voor echte users). Eén van beide is gevuld.

### Frontend wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| **Nieuw** `src/hooks/usePOSCashiers.ts` | CRUD hook voor pos_cashiers + `verifyPin` functie (roept DB function aan) |
| **Nieuw** `src/components/admin/pos/POSCashierSelect.tsx` | Compacte UI: avatar-grid met namen → PIN invoer (4 digits, auto-submit) |
| **Nieuw** `src/components/admin/settings/CashierManagement.tsx` | Admin CRUD: lijst, toevoegen (naam + PIN), bewerken, deactiveren |
| `src/components/admin/settings/TeamSettings.tsx` | Nieuw tabblad/sectie "Kassa medewerkers" met `CashierManagement` |
| `src/pages/admin/POSTerminal.tsx` | State `activeCashier` — bij sessie-open of wissel: toon `POSCashierSelect`. Cashier-id meegeven aan transacties |
| `src/hooks/usePOS.ts` | `createTransaction` accepteert optioneel `posCashierId` naast `cashierId` |
| `src/components/admin/pos/POSCartPanel.tsx` | Kleine avatar + naam van actieve kassamedewerker in header, klik = wissel |

### Hoe het werkt

1. **Admin maakt kassamedewerker aan** — naam + 4-cijferige PIN. PIN wordt server-side gehasht (bcrypt via pgcrypto). Geen e-mail, geen account.

2. **POS Terminal openen** — als er kassa-medewerkers bestaan voor deze tenant, verschijnt na het openen van de sessie automatisch de cashier-select: avatars met namen. Tik op je naam → voer PIN in → klaar.

3. **Wissel tijdens de dag** — in de POS header staat de naam van de actieve medewerker. Klik → dezelfde select verschijnt. Nieuwe medewerker selecteert + PIN. Geen hele sessie heropenen.

4. **Transacties** — elke verkoop slaat `pos_cashier_id` op, zodat je in rapporten ziet wie wat heeft verkocht.

5. **Geen kassa-medewerkers?** — dan werkt alles zoals nu (ingelogde user = cashier). Volledig backwards compatible.

### Bestanden overzicht

| Actie | Bestand |
|-------|---------|
| Migratie | `pos_cashiers` tabel + `verify_cashier_pin` + `hash_cashier_pin` functies + `pos_cashier_id` kolom op `pos_transactions` |
| Nieuw | `src/hooks/usePOSCashiers.ts` |
| Nieuw | `src/components/admin/pos/POSCashierSelect.tsx` |
| Nieuw | `src/components/admin/settings/CashierManagement.tsx` |
| Wijzig | `src/components/admin/settings/TeamSettings.tsx` |
| Wijzig | `src/pages/admin/POSTerminal.tsx` |
| Wijzig | `src/hooks/usePOS.ts` |
| Wijzig | `src/components/admin/pos/POSCartPanel.tsx` |
| Wijzig | `src/types/pos.ts` |

