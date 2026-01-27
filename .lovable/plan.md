
# Stripe Configuratie Problemen Oplossen

## Samenvatting van de Problemen

### Probleem 1: Verkeerde 5% Transactie Fee Weergave
- Op de instellingenpagina wordt **"5% per transactie"** hardcoded getoond
- Als platform eigenaar (SellQo) zou dit niet van toepassing moeten zijn of anders weergegeven moeten worden

### Probleem 2: "Stripe Dashboard openen" knop werkt niet correct
- De knop roept `createConnectAccount` aan, wat een **onboarding link** genereert
- Stripe onboarding links kunnen NIET worden embedded (CSP violations in console)
- Er is geen functie om naar het echte Stripe Express Dashboard te navigeren

---

## Technische Oplossing

### 1. Platform Fee Weergave Aanpassen

**Bestand:** `src/components/admin/settings/PaymentSettings.tsx`

Drie opties:
- **Optie A:** Verberg platform fee sectie volledig voor internal tenants
- **Optie B:** Toon "0% - Ongelimiteerd" voor internal tenants
- **Optie C:** Haal de werkelijke fee op uit een configuratie

Aanbevolen: **Optie A** - Verberg voor internal tenants

```tsx
// Conditie toevoegen rond de platform fee box
{!currentTenant?.is_internal_tenant && (
  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
    <Percent className="h-5 w-5 text-muted-foreground" />
    <div>
      <p className="text-sm font-medium">Platform fee</p>
      <p className="text-xs text-muted-foreground">5% per transactie</p>
    </div>
  </div>
)}
```

### 2. Nieuwe "Open Stripe Dashboard" Functie

**Nieuw bestand:** `supabase/functions/get-stripe-login-link/index.ts`

Stripe biedt een speciale API voor Express accounts om een inlog-link te genereren:

```typescript
// Stripe biedt stripe.accounts.createLoginLink()
const loginLink = await stripe.accounts.createLoginLink(
  tenantData.stripe_account_id
);
// Retourneert een URL naar het Express Dashboard
return { url: loginLink.url };
```

### 3. useStripeConnect Hook Uitbreiden

**Bestand:** `src/hooks/useStripeConnect.ts`

Nieuwe functie toevoegen:

```typescript
const openStripeDashboard = useCallback(async () => {
  if (!tenantId) return;
  
  setIsLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('get-stripe-login-link', {
      body: { tenant_id: tenantId },
    });

    if (error) throw error;
    
    if (data.url) {
      window.open(data.url, '_blank');
    }
  } catch (error) {
    toast({
      title: 'Fout',
      description: 'Kon Stripe Dashboard niet openen.',
      variant: 'destructive',
    });
  } finally {
    setIsLoading(false);
  }
}, [tenantId, toast]);
```

### 4. PaymentSettings.tsx Button Fix

**Bestand:** `src/components/admin/settings/PaymentSettings.tsx`

Vervang de knop die `createConnectAccount` aanroept:

```tsx
// Van:
<Button onClick={createConnectAccount}>
  Stripe Dashboard openen
</Button>

// Naar:
<Button onClick={openStripeDashboard}>
  Stripe Dashboard openen
</Button>
```

---

## Bestanden te Wijzigen/Maken

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `supabase/functions/get-stripe-login-link/index.ts` | **Nieuw** | Edge function voor Stripe dashboard login link |
| `src/hooks/useStripeConnect.ts` | Wijzigen | `openStripeDashboard` functie toevoegen |
| `src/components/admin/settings/PaymentSettings.tsx` | Wijzigen | Platform fee verbergen voor internal tenant, nieuwe knop functie gebruiken |

---

## Stripe Login Link API Details

De Stripe API `accounts.createLoginLink` genereert een eenmalige URL waarmee de tenant-eigenaar rechtstreeks naar hun Stripe Express Dashboard kan navigeren. Deze link:
- Is geldig voor 5 minuten
- Werkt in een nieuwe tab (geen iframe issues)
- Geeft toegang tot transacties, uitbetalingen, instellingen etc.

---

## Samenvatting

Na deze wijzigingen:
1. SellQo ziet geen "5% per transactie" meer (irrelevant als platform owner)
2. "Stripe Dashboard openen" knop opent daadwerkelijk het Stripe dashboard in een nieuwe tab
3. Geen CSP errors meer omdat we direct navigeren i.p.v. embedding proberen
