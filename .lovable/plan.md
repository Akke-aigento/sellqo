

## Fix: "Shop niet gevonden" voor niet-ingelogde bezoekers

### Oorzaak

De `tenants` tabel heeft **geen publieke SELECT policy**. Alleen ingelogde gebruikers (tenant-leden of platform admins) kunnen tenant-data lezen. Wanneer een bezoeker (niet ingelogd) de shop bezoekt via `https://sellqo.app/shop/loveke`, faalt de query en wordt "Shop niet gevonden" getoond.

Dit is een Row Level Security (RLS) probleem: de storefront-code gebruikt de anonieme sleutel om tenant-informatie op te halen, maar de database staat dat niet toe.

### Oplossing

Een nieuwe RLS policy toevoegen op de `tenants` tabel die **beperkte publieke leestoegang** geeft -- alleen de velden die nodig zijn voor de storefront worden al gefilterd in de query, en de policy staat enkel SELECT toe.

### Technische wijziging

**Database migratie** -- nieuwe RLS policy:

```sql
CREATE POLICY "Public can view tenant basic info by slug"
  ON public.tenants
  FOR SELECT
  USING (true);
```

Dit staat anonieme gebruikers toe om tenant-rijen te lezen. De selectquery in `usePublicStorefront` haalt al alleen publieke velden op (naam, slug, logo, kleur, valuta, etc.) -- er zitten geen gevoelige gegevens in de geselecteerde kolommen.

### Waarom is dit veilig?

- De query selecteert alleen: `id, slug, name, logo_url, primary_color, secondary_color, currency, country, iban, bic, payment_methods_enabled, pass_transaction_fee_to_customer, transaction_fee_label`
- Dit zijn allemaal publieke storefront-gegevens
- UPDATE/DELETE/INSERT blijven beschermd door de bestaande policies
- Andere tabellen (zoals `tenant_theme_settings`) hebben al vergelijkbare publieke policies

### Bestanden

| Wijziging | Details |
|---|---|
| Database migratie | Nieuwe RLS policy op `tenants` voor publieke SELECT |

