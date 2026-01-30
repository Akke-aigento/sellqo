

# Plan: Automatische Prospect/Klant Aanmaak + Klantdetailpagina

## Huidige Problemen

1. **Route `/admin/customers/:id` bestaat niet** → 404 bij klikken op "Klantprofiel"
2. **Inkomende berichten van onbekende afzenders worden niet aan klanten gekoppeld**
3. **Waardevolle prospect-data gaat verloren**

---

## Logische Werkwijze

```text
Inkomend bericht
      │
      ▼
┌─────────────────────────────────┐
│ Zoek klant op email             │
└─────────────────────────────────┘
      │
      ├── Gevonden? → Koppel aan bestaande klant
      │
      └── Niet gevonden? 
                │
                ▼
    ┌────────────────────────────────────┐
    │ MAAK PROSPECT AAN                  │
    │ • customer_type = 'prospect'       │
    │ • email = afzender                 │
    │ • Naam = parsed uit From header   │
    │ • total_orders = 0                 │
    │ • Bron = 'inbox'                   │
    └────────────────────────────────────┘
                │
                ▼
    Bericht gekoppeld aan prospect → Zichtbaar in profiel!
```

### Waarom dit slim is:
- **Alle communicatie gekoppeld** - Je ziet in klantprofiel alle berichten
- **Prospect → Klant conversie tracking** - Als ze later bestellen, zie je de hele journey
- **Verkoopkansen herkennen** - Prospects kunnen getagd/gefilterd worden
- **CRM-waarde** - Geen losse eindjes, alles traceerbaar

---

## Technische Implementatie

### Fase 1: Klantdetailpagina (lost 404 op)

**Nieuw bestand: `src/pages/admin/CustomerDetail.tsx`**

Bevat:
- Klantgegevens (naam, email, telefoon, adressen)
- Type badge (B2C / B2B / **Prospect**)
- Bestellingen overzicht
- **Gesprekken/berichten** van deze klant (inbox integratie!)
- Totaal uitgegeven + statistieken
- Notities en tags

**Route toevoegen in `App.tsx`:**
```typescript
<Route path="customers/:customerId" element={<CustomerDetailPage />} />
```

### Fase 2: Automatische Prospect Aanmaak (Edge Function)

**Wijzigen: `handle-inbound-email/index.ts`**

```typescript
// Na: "If no order match, try to find customer by email"
if (!customerId) {
  const emailMatch = payload.from.match(/<([^>]+)>/) || [null, payload.from];
  const cleanEmail = emailMatch[1] || payload.from;
  const parsedName = parseNameFromEmail(payload.from); // "Jan de Vries <jan@...>" → {first: "Jan", last: "de Vries"}

  // Zoek bestaande klant
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", cleanEmail.toLowerCase())
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
  } else {
    // NIEUW: Maak prospect aan
    const { data: newProspect } = await supabase
      .from("customers")
      .insert({
        tenant_id: tenantId,
        email: cleanEmail.toLowerCase(),
        first_name: parsedName?.first || null,
        last_name: parsedName?.last || null,
        customer_type: 'prospect',  // Nieuw type!
        notes: `Automatisch aangemaakt vanuit inbox - eerste contact via ${channel}`,
        total_orders: 0,
        total_spent: 0,
      })
      .select("id")
      .single();

    if (newProspect) {
      customerId = newProspect.id;
      console.log(`Created new prospect: ${cleanEmail}`);
    }
  }
}
```

### Fase 3: Database Aanpassing

**Nieuwe customer_type waarde:**

De `customers.customer_type` kolom bestaat al (TEXT). We voegen gewoon 'prospect' toe als geldige waarde naast 'b2c' en 'b2b'.

### Fase 4: UI Verbeteringen

**CustomersPage.tsx:**
- Filter op type (B2C / B2B / Prospect)
- Prospect badge met speciale kleur
- "Converteer naar klant" actie

**ConversationDetail.tsx:**
- "Klantprofiel" knop altijd tonen (ook voor prospects)
- Optie "Maak klant aan" als nog geen profiel bestaat (fallback voor oude berichten)

---

## Bestanden te Wijzigen/Aanmaken

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/CustomerDetail.tsx` | **NIEUW** - Volledige klantdetailpagina |
| `src/App.tsx` | Route toevoegen voor `/admin/customers/:customerId` |
| `supabase/functions/handle-inbound-email/index.ts` | Automatische prospect aanmaak |
| `src/pages/admin/Customers.tsx` | Filter op type, prospect badge |
| `src/hooks/useCustomers.ts` | `useCustomer()` hook voor detail ophalen |
| `src/components/admin/inbox/ConversationDetail.tsx` | "Maak klant aan" fallback knop |

---

## Klantdetailpagina Layout

```text
┌────────────────────────────────────────────────────────────────┐
│ ← Terug naar klanten                                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [Avatar]  Jan de Vries                    [Prospect] [🏢 B2B]│
│            jan@bedrijf.nl • +31 6 12345678                    │
│            Klant sinds: 15 jan 2025                           │
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ €0,00        │ │ 0            │ │ 3            │           │
│  │ Totaal       │ │ Bestellingen │ │ Gesprekken   │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
├────────────────────────────────────────────────────────────────┤
│ [Bestellingen] [Gesprekken] [Gegevens] [Notities]              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  📦 Geen bestellingen                                          │
│                                                                │
│  💬 Gesprekken                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 📧 Vraag over product X               vandaag 14:32       ││
│  │ 📧 Re: Offerte aanvraag               gisteren            ││
│  │ 📧 Interesse in bulk bestelling       18 jan              ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Prospect → Klant Conversie Flow

```text
Prospect komt binnen via email
        │
        ▼
Merchant antwoordt via inbox
        │
        ▼
Prospect plaatst bestelling (webshop/handmatig)
        │
        ▼
Order trigger updatet customer_type → 'b2c'/'b2b'
        │
        ▼
✅ Volledig klantprofiel met hele journey zichtbaar!
```

---

## Voordelen van deze Aanpak

1. **Geen 404 meer** - Klantprofiel werkt altijd
2. **Volledige communicatiehistorie** - Alle berichten gekoppeld
3. **Verkoopinzichten** - Zie welke prospects interesse tonen
4. **Schoon CRM** - Geen losse berichten van "onbekende afzenders"
5. **Conversie tracking** - Van prospect naar klant journey
6. **Toekomstbestendig** - Basis voor lead scoring, automations, etc.

---

## Samenvatting

Dit plan lost drie problemen tegelijk op:
1. **404 error** → Nieuwe klantdetailpagina met route
2. **Prospects niet aangemaakt** → Automatisch in edge function
3. **Data niet benut** → Volledige integratie inbox ↔ klantprofiel

Wil je dit uitvoeren?

