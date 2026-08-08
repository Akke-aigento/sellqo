# Compliance-vraag: fysieke regio van Supabase-infrastructuur

## Vraag
In welk fysieke land draait de primaire Supabase-dataopslag voor dit project?

## Bevindingen

### 1. Supabase project-regio
De regio is af te leiden uit de **pooler connection string** die Supabase voor dit project rapporteert:

```
postgresql://postgres.gczmfcabnoofnmfpzeop:[YOUR-PASSWORD]@aws-1-eu-north-1.pooler.supabase.com:6543/postgres
```

- **Regio-code:** `eu-north-1`
- **DNS-verificatie:** `aws-1-eu-north-1.pooler.supabase.com` resolved naar `pool-tcp-eun11-...elb.eu-north-1.amazonaws.com`.
- **Database-server IPv6:** `2a05:d016:571:a40f:fd81:a7b3:64f7:38b2/128` valt eveneens binnen het AWS `eu-north-1` bereik.

### 2. Concreet land
| Regio-code | Land |
|------------|------|
| `eu-north-1` | **Zweden** (Stockholm) |

### 3. Cloudflare-context
De project-URL `https://gczmfcabnoofnmfpzeop.supabase.co` resolved naar Cloudflare-edge IPs (`172.64.149.246`, `104.18.38.10`). Dat is het wereldwijde CDN/cache-laagje, niet de primaire dataopslag. Voor compliance telt de primaire database-opslag, en die staat in **eu-north-1 / Zweden**.

## Antwoord voor de vragenlijst
- **Regio-code:** `eu-north-1`
- **Land van primaire dataopslag:** Zweden

Geen wijzigingen aangebracht; dit is een puur informatief rapport.
