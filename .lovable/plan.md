
# Routing-logica: Custom Frontend + Custom Domeinen

## Huidige Situatie

Op dit moment bestaan custom domeinen en custom frontend als twee losstaande features:

- **Custom Frontend**: slaat een `custom_frontend_url` op in `tenant_theme_settings`, maar er is geen logica die bezoekers daadwerkelijk routeert
- **Custom Domeinen**: `tenant_domains` tabel met DNS-verificatie, maar geen routing naar de custom frontend
- **Storefront routes**: `/shop/:tenantSlug/*` routes serveren altijd het SellQo-theme, ongeacht of een custom frontend actief is
- **Storefront API**: accepteert `tenant_id` maar geen `domain` of `locale` parameter -- er is geen domain-aware content

Er is dus **geen werkende routing** tussen deze features. De custom frontend URL wordt nergens gebruikt behalve als informatie in het dashboard.

## Wat er gebouwd wordt

### 1. Edge Function: `storefront-resolve` (nieuw)

Een nieuwe edge function die als centraal routeringspunt fungeert. Wanneer een bezoeker een domein bezoekt:

1. Zoekt het domein op in `tenant_domains`
2. Haalt de tenant en theme settings op
3. Bepaalt de routing:
   - Custom frontend actief? Geeft de `custom_frontend_url` + locale + tenant info terug
   - Standaard theme? Geeft tenant slug terug voor de SellQo storefront

Dit is geen reverse proxy (dat vereist infrastructuur buiten Lovable), maar een **resolve endpoint** dat de custom frontend kan aanroepen bij het laden om te weten welke tenant/locale actief is.

### 2. Storefront API: `resolve_domain` actie toevoegen

De bestaande `storefront-api` edge function krijgt een nieuwe actie `resolve_domain`:

```text
POST /storefront-api
{
  "action": "resolve_domain",
  "params": { "hostname": "vanxcel.be" }
}
```

Retourneert:
- `tenant_id`, `tenant_slug`, `locale`, `is_canonical`
- `use_custom_frontend`, `custom_frontend_url`
- Alle actieve domeinen (voor hreflang)

Dit stelt de custom frontend in staat om bij het laden automatisch te detecteren via welk domein de bezoeker binnenkomt, zonder hardcoded tenant ID's.

### 3. Storefront API: locale-aware product data

De bestaande `get_products` en `get_tenant` acties in de storefront-api worden uitgebreid met een optionele `locale` parameter. Wanneer meegegeven:

- Product namen, beschrijvingen en SEO-velden worden opgehaald uit `content_translations` als de locale afwijkt van de standaardtaal
- Categorie-namen worden vertaald
- Tenant info (store_name, store_description) wordt vertaald indien beschikbaar

### 4. SellQo Storefront: redirect-logica

De bestaande `/shop/:tenantSlug` routes krijgen een check aan het begin:

- Als de tenant `use_custom_frontend = true` heeft en een `custom_frontend_url` is ingesteld, redirect de bezoeker naar de custom frontend URL
- Als er custom domeinen bestaan met een canonical domein, redirect naar `https://canonical-domain/`
- Alleen als er geen custom frontend EN geen custom domeinen zijn, toon het SellQo theme

### 5. Dashboard: Storefront URL-weergave verbeteren

De Webshop-pagina header en StorefrontSettings worden aangepast:

- **Preview URL**: toont het canonical domein als dat bestaat, anders de SellQo URL
- **Custom Frontend sectie**: toont een hint wanneer er geen domeinen gekoppeld zijn ("Koppel een eigen domein zodat klanten niet de lovable.app URL zien")
- **Custom Frontend sectie**: toont welke domeinen de custom frontend serveren wanneer er wel domeinen zijn

### 6. Domeinen-sectie: frontend-indicator

In `MultiDomainSettings` wordt per domein getoond wat het serveert:
- Badge "Custom Frontend" als `use_custom_frontend = true`
- Badge "SellQo Theme" als standaard theme actief is

Plus een info-alert bovenaan als custom frontend actief is: "Alle geverifieerde domeinen serveren je custom frontend op [URL]"

## Routeringsmatrix

| Custom Domeinen | Custom Frontend | Bezoeker typt | Resultaat |
|----------------|----------------|---------------|-----------|
| Ja (geverifieerd) | Ja | vanxcel.be | Custom frontend, locale=nl |
| Ja (geverifieerd) | Ja | vanxcel.com | Custom frontend, locale=en |
| Ja (geverifieerd) | Nee | vanxcel.be | SellQo theme, locale=nl |
| Nee | Ja | sellqo.app/shop/vanxcel | Redirect naar custom_frontend_url |
| Nee | Nee | sellqo.app/shop/vanxcel | SellQo theme (standaard) |

## Technische Details

### Bestanden die aangemaakt worden

| Bestand | Beschrijving |
|---------|-------------|
| `supabase/functions/storefront-resolve/index.ts` | Domain resolve endpoint voor custom frontends |

### Bestanden die gewijzigd worden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/storefront-api/index.ts` | Nieuwe `resolve_domain` actie + `locale` parameter op `get_products`/`get_tenant` |
| `src/components/storefront/ShopLayout.tsx` | Redirect-logica: check custom frontend en custom domeinen |
| `src/pages/admin/Storefront.tsx` | Preview URL logica: toon canonical domein als primaire URL |
| `src/components/admin/storefront/StorefrontSettings.tsx` | Hint bij custom frontend zonder domeinen, toon gekoppelde domeinen |
| `src/components/admin/settings/MultiDomainSettings.tsx` | Badge per domein: "Custom Frontend" of "SellQo Theme" |

### Beperkingen

- **Reverse proxy is niet mogelijk** binnen de Lovable/Supabase stack. De custom frontend draait op zijn eigen domein (lovable.app). De custom domeinen van de tenant worden via DNS naar Lovable's IP (185.158.133.1) gericht, wat het Lovable platform zelf afhandelt. De `storefront-resolve` endpoint stelt de custom frontend in staat om domain-aware te zijn zonder reverse proxy.
- De custom frontend is verantwoordelijk voor het aanroepen van `resolve_domain` bij het laden en het gebruiken van de juiste locale. SellQo levert de API en data, niet de hosting van de custom frontend.

### Volgorde van implementatie

1. `storefront-api` uitbreiden met `resolve_domain` actie en `locale` parameter
2. `storefront-resolve` edge function aanmaken
3. `ShopLayout.tsx` redirect-logica toevoegen
4. Dashboard UI aanpassingen (StorefrontSettings, Storefront pagina, MultiDomainSettings)
