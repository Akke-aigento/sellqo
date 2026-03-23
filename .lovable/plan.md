

## Domeinarchitectuur voor Custom Frontend Tenants

### Het probleem

Er zijn drie lagen die elk "domeinen" beheren, en die moeten correct samenwerken:

1. **DNS (Cloudflare)** — waar het domein fysiek naartoe wijst (IP-adres)
2. **Lovable hosting** — welk Lovable-project het domein serveert
3. **SellQo tenant_domains** — welke tenant bij het domein hoort (voor API-context)

### De juiste architectuur

```text
Bezoeker typt vanxcel.be
        │
        ▼
   DNS (Cloudflare)
   A-record → Lovable IP (185.158.133.1)
        │
        ▼
   Lovable routing
   Domein gekoppeld aan Vanxcel-project (80408260...)
        │
        ▼
   Vanxcel frontend laadt
   Roept storefront-resolve aan met hostname="vanxcel.be"
        │
        ▼
   SellQo storefront-resolve
   Zoekt in tenant_domains → vindt tenant + locale + config
        │
        ▼
   Vanxcel frontend toont producten via Storefront API
```

### Conclusie per laag

**DNS (Cloudflare):** De A-records voor vanxcel.be/nl/com moeten naar `185.158.133.1` wijzen — dat is het Lovable IP. Dit is al gedaan via de Cloudflare auto-connect.

**Lovable domein-koppeling:** De domeinen moeten gekoppeld worden in het **Vanxcel Lovable-project**, NIET in het SellQo-project. Lovable moet weten welk project het moet serveren als iemand vanxcel.be bezoekt.

**SellQo tenant_domains:** De domeinen moeten WEL in de SellQo database blijven staan, want `storefront-resolve` en `storefront-api` gebruiken deze tabel om de juiste tenant, locale en config te resolven. MAAR:
- De DNS-verificatie (`dns_verified`, `ssl_active`) is niet meer relevant voor SellQo — dat beheert Lovable nu
- De Cloudflare auto-connect vanuit SellQo is niet meer nodig voor custom frontend tenants

### Wat er moet veranderen

**1. Veld toevoegen aan `tenant_domains`: `hosting_mode`**

Een nieuw veld dat aangeeft of SellQo of een extern platform het domein host:
- `sellqo` (default) — SellQo beheert DNS-verificatie, SSL, en serveert de storefront
- `external` — domein wordt extern gehost (bijv. in een ander Lovable-project); SellQo gebruikt het alleen voor API-context/routing

**2. UI aanpassen: DNS-verificatie verbergen voor external domeinen**

In het domein-instellingenpaneel (`MultiDomainSettings` / `DomainVerificationPanel`):
- Als `use_custom_frontend` aan staat, worden nieuwe domeinen automatisch als `hosting_mode: 'external'` toegevoegd
- External domeinen tonen GEEN DNS-verificatie stappen, geen Cloudflare connect, geen SSL-status
- Wel tonen: domein, locale, canonical status (voor hreflang/API-routing)
- Info-banner: "Dit domein wordt gehost in je custom frontend. Koppel het daar aan je project."

**3. storefront-resolve ongewijzigd**

De resolve-functie zoekt alleen op `domain + is_active`. Het maakt niet uit of het domein `sellqo` of `external` gehost is — de API-context is identiek. Geen wijziging nodig.

**4. Drie domeinen, verschillende locales**

Voor de 3 Vanxcel-domeinen:
| Domein | Locale | Canonical | Hosting |
|---|---|---|---|
| vanxcel.be | nl | ✓ | external |
| vanxcel.nl | nl | | external |
| vanxcel.com | en | | external |

De Vanxcel frontend roept bij laden `storefront-resolve` aan met `window.location.hostname` en krijgt de juiste locale terug. Op basis daarvan toont het de juiste taal.

### Bestanden

| Bestand | Wijziging |
|---|---|
| **Database migratie** | `hosting_mode` kolom toevoegen aan `tenant_domains` (default `'sellqo'`) |
| `src/hooks/useTenantDomains.ts` | Type uitbreiden met `hosting_mode` |
| `src/components/admin/settings/MultiDomainSettings.tsx` | Auto-set `hosting_mode: 'external'` bij custom frontend; DNS-verificatie UI verbergen voor external |
| `src/components/admin/settings/DomainVerificationPanel.tsx` | Niet tonen voor external domeinen |
| `src/components/admin/storefront/StorefrontSettings.tsx` | Info-tekst toevoegen dat domeinen extern gekoppeld moeten worden |

### Wat NIET verandert
- `storefront-resolve` — werkt al correct
- `storefront-api` — werkt al correct
- `cloudflare-api-connect` — blijft werken voor `sellqo`-hosted domeinen
- `verify-domain` — blijft werken voor `sellqo`-hosted domeinen

