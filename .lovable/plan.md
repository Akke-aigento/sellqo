

## Fix: Disconnect Stripe — verkeerde kolomnaam

### Probleem
De edge functions `disconnect-stripe-account` en `cleanup-connected-accounts` proberen de kolom `stripe_details_submitted` te updaten, maar die bestaat niet. De juiste kolomnaam is **`stripe_onboarding_complete`**.

Hierdoor wordt het Stripe account wél verwijderd, maar faalt de database-update met een 500 error. De UI toont dan "Ontkoppelen mislukt" terwijl het account al weg is.

### Oplossing
In beide edge functions de kolomnaam wijzigen:

**Bestand 1: `supabase/functions/disconnect-stripe-account/index.ts`** (regel 119)
```
stripe_details_submitted: false  →  stripe_onboarding_complete: false
```

**Bestand 2: `supabase/functions/cleanup-connected-accounts/index.ts`** (regel 164)
```
stripe_details_submitted: false  →  stripe_onboarding_complete: false
```

### Resultaat
- Stripe account wordt verwijderd (werkt al)
- Database wordt correct gereset (fix)
- Function retourneert 200 i.p.v. 500 (fix)
- UI toont succesmelding i.p.v. foutmelding (fix)

