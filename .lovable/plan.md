

## SellQo tenant onbeperkte subscription instellen

### Situatie
De tenant "SellQo" (`d03c63fe-48c6-4ff7-a30b-7506ea3e71ab`) heeft `is_internal_tenant = true` en `subscription_plan = 'enterprise'`, maar er is **geen record in `tenant_subscriptions`**. Hierdoor kunnen bepaalde checks falen die de subscription opzoeken.

### Oplossing
Een database migratie uitvoeren die een `tenant_subscriptions` record toevoegt voor de SellQo tenant:

```sql
INSERT INTO tenant_subscriptions (
  tenant_id, plan_id, status, billing_interval,
  current_period_start, current_period_end
) VALUES (
  'd03c63fe-48c6-4ff7-a30b-7506ea3e71ab',
  'enterprise',
  'active',
  'yearly',
  now(),
  (now() + interval '100 years')
) ON CONFLICT DO NOTHING;
```

Dit geeft de platform-eigenaar een actieve Enterprise subscription met een einddatum ver in de toekomst. In combinatie met de bestaande `is_internal_tenant = true` check in de code (die unlimited credits/features geeft) is de tenant dan volledig onbeperkt.

### Bestanden
- Alleen een database migratie (INSERT) — geen codewijzigingen nodig.

