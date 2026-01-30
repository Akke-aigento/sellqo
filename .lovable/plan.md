

# Plan: Automatische Prospect Aanmaak voor Alle Kanalen

## Huidige Situatie

| Kanaal | Klant zoeken | Prospect aanmaken | Status |
|--------|--------------|-------------------|--------|
| Email | ✅ Op email | ✅ Ja | Werkt |
| WhatsApp | ⚠️ Op whatsapp_number | ❌ Nee | customer_id = null |
| Facebook | ⚠️ Op facebook_psid | ❌ Nee | customer_id = null |
| Instagram | ⚠️ Op instagram_id | ❌ Nee | customer_id = null |

## Gewenste Situatie

Alle kanalen maken automatisch een prospect aan als de afzender onbekend is:

```text
Inkomend bericht (elk kanaal)
        │
        ▼
┌───────────────────────────────────────┐
│ Zoek klant op kanaal-specifiek veld   │
│ - Email: email adres                  │
│ - WhatsApp: telefoonnummer            │
│ - Facebook: PSID                      │
│ - Instagram: IGSID                    │
└───────────────────────────────────────┘
        │
        ├── Gevonden? → Koppel aan bestaande klant
        │
        └── Niet gevonden?
                │
                ▼
    ┌────────────────────────────────────┐
    │ MAAK PROSPECT AAN                  │
    │ • customer_type = 'prospect'       │
    │ • Kanaal-ID opslaan               │
    │ • Bron = kanaal (whatsapp/fb/ig)  │
    └────────────────────────────────────┘
```

---

## Technische Wijzigingen

### 1. WhatsApp Webhook (`whatsapp-webhook/index.ts`)

Na het zoeken op `whatsapp_number`, als geen klant gevonden:

```typescript
// Regel ~105-110: Na customer lookup
let customerId = customer?.id || null;

if (!customerId) {
  // Maak prospect aan met telefoonnummer
  const { data: newProspect } = await supabase
    .from('customers')
    .insert({
      tenant_id: connection.tenant_id,
      whatsapp_number: fromPhone,
      phone: fromPhone,  // Backup in phone veld
      customer_type: 'prospect',
      notes: 'Automatisch aangemaakt vanuit WhatsApp inbox',
      total_orders: 0,
      total_spent: 0,
    })
    .select('id')
    .single();
  
  if (newProspect) {
    customerId = newProspect.id;
    console.log(`Created WhatsApp prospect: ${fromPhone}`);
  }
}

// Gebruik customerId bij insert (nu altijd gevuld)
```

### 2. Meta Messaging Webhook (`meta-messaging-webhook/index.ts`)

Na het zoeken op `facebook_psid` of `instagram_id`:

```typescript
// Regel ~103-109: Na customer lookup
let customerId = customer?.id || null;

if (!customerId) {
  // Haal profiel info op van Meta API (optioneel)
  // Voor nu: basis prospect aanmaken
  const insertData: Record<string, any> = {
    tenant_id: connection.tenant_id,
    customer_type: 'prospect',
    notes: `Automatisch aangemaakt vanuit ${platform === 'instagram' ? 'Instagram' : 'Facebook Messenger'} inbox`,
    total_orders: 0,
    total_spent: 0,
  };
  
  // Platform-specifieke identifier opslaan
  if (platform === 'instagram') {
    insertData.instagram_id = senderId;
  } else {
    insertData.facebook_psid = senderId;
  }
  
  const { data: newProspect } = await supabase
    .from('customers')
    .insert(insertData)
    .select('id')
    .single();
  
  if (newProspect) {
    customerId = newProspect.id;
    console.log(`Created ${platform} prospect: ${senderId}`);
  }
}
```

### 3. Database: Nieuwe kolommen op `customers` tabel

De kolommen `instagram_id` en `facebook_psid` moeten bestaan voor matching. Laat me checken of deze al bestaan:

```sql
-- Als ze nog niet bestaan, toevoegen:
ALTER TABLE customers ADD COLUMN IF NOT EXISTS facebook_psid TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram_id TEXT;

-- Indexes voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_customers_facebook_psid ON customers(tenant_id, facebook_psid) WHERE facebook_psid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_instagram_id ON customers(tenant_id, instagram_id) WHERE instagram_id IS NOT NULL;
```

---

## Bestanden te Wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Prospect aanmaken bij onbekend telefoonnummer |
| `supabase/functions/meta-messaging-webhook/index.ts` | Prospect aanmaken bij onbekend Facebook/Instagram ID |
| Database migratie | Kolommen `facebook_psid` en `instagram_id` + indexes |

---

## Resultaat per Kanaal

### WhatsApp Prospect
```text
┌──────────────────────────────────┐
│ 👤 +31 6 12345678                │
│ [Prospect] [📱 WhatsApp]          │
│                                  │
│ 📞 +31 6 12345678                │
│ Eerste contact: 30 jan 2026     │
│ Bron: WhatsApp                   │
│                                  │
│ 💬 3 gesprekken                   │
└──────────────────────────────────┘
```

### Facebook/Instagram Prospect
```text
┌──────────────────────────────────┐
│ 👤 Facebook User 1234567890      │
│ [Prospect] [📘 Facebook]          │
│                                  │
│ Facebook ID: 1234567890          │
│ Eerste contact: 30 jan 2026     │
│ Bron: Facebook Messenger         │
│                                  │
│ 💬 2 gesprekken                   │
└──────────────────────────────────┘
```

---

## Bonus: Meta Profiel Ophalen (optioneel, fase 2)

Facebook/Instagram API kan profielinfo geven:

```typescript
// Optioneel: Haal naam/profielfoto op van Meta
const profileResponse = await fetch(
  `https://graph.facebook.com/${senderId}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`
);
const profile = await profileResponse.json();
// → first_name: "Jan", last_name: "de Vries", profile_pic: "https://..."
```

Dit kunnen we later toevoegen om prospects direct een naam te geven.

---

## Voordelen

1. **Alle kanalen consistent** - Prospect aanmaak werkt overal hetzelfde
2. **Geen losse berichten** - Elke conversatie gekoppeld aan klant/prospect
3. **Cross-channel matching** - Als WhatsApp prospect later ook mailt, herkennen we ze
4. **Complete customer journey** - Van eerste DM tot aankoop, alles zichtbaar
5. **Betere CRM** - Prospects kunnen worden geconverteerd, getagd, gefilterd

---

## Samenvatting

Dit plan breidt de automatische prospect-aanmaak uit naar **alle communicatiekanalen**:

- WhatsApp berichten van onbekende nummers → Prospect met telefoonnummer
- Facebook Messenger berichten → Prospect met Facebook PSID
- Instagram DMs → Prospect met Instagram ID

Alle communicatie wordt dan altijd aan een klant- of prospectprofiel gekoppeld!

