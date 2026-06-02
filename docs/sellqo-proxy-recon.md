# Reconnaissance: sellqo-proxy vs storefront-api

## 1. Status van sellqo-proxy

- **Repo-presence**: `sellqo-proxy` staat niet in deze repo. `supabase/functions/` bevat `storefront-api`, `storefront-customer-api`, `storefront-resolve`, `track-storefront-event`, `generate-storefront-api-key`, en `ai-generate-storefront-copy`.
- **Project-mismatch**: de function is gedeployd op Supabase-project **`jpnacppdutjnasmuikgp`**. Deze Lovable-repo is gekoppeld aan **`gczmfcabnoofnmfpzeop`** — de Supabase-integratietools in deze sessie zijn gescoped op dat project. Daarom kan de gedeployde source en last-deployed-datum van `sellqo-proxy` hier niet worden opgehaald.
- **Dispatcher-gedrag** (path-based, afgeleid uit black-box probes met `X-Tenant-ID: vanxcel`):

  | Path | Response | Status |
  |---|---|---|
  | `/products` | `{success, data: {products:[…]}}` | herkend |
  | `/categories` | `{success, data:[…]}` | herkend |
  | `/collections` | `{success, data:[…]}` (alias/duplicaat van categories) | herkend |
  | `/pages` | `{data:[]}` (geen `success`-wrapper — inconsistent) | herkend |
  | `/cart` | vereist `session_id` | herkend |
  | `/checkout` | dubbel-gewrapte storefront-api-response (`success→data→success`) | herkend |
  | `/newsletter` | vereist `email` | herkend |
  | `/contact`, `/search`, `/customer`, `/login`, `/register`, `/track`, `/form`, `/submit`, `/ping`, `/health`, `/resolve`, `/subscribe`, `/stripe-webhook`, etc. | `{"success":false,"error":"Unknown action: X"}` | **niet** herkend |

- **Wrapper-architectuur**: de `/checkout`-response bevat `{code:"CART_NOT_FOUND", message:"…"}` — exact de error-shape van `storefront-api` zoals gedocumenteerd in `docs/checkout-api-contract.md`. Conclusie: `sellqo-proxy` is een dunne **path→action proxy** die intern `storefront-api` aanroept met body-based dispatch.

## 2. Relatie tot storefront-api

- **`storefront-api`** (in deze repo): body-based contract, `POST /functions/v1/storefront-api` met `{action, tenant_id, params}`. Canonical engine en SSOT voor checkout, cart, en alle storefront-acties. Gedocumenteerd in `docs/checkout-api-contract.md`.
- **`sellqo-proxy`**: path-based contract met `X-Tenant-ID`-header. Biedt slechts een subset (~7 acties) en mist onder andere `contact`, customer/auth, tracking, en resolve.
- **Welke client gebruikt wat**:
  - SellQo-eigen frontend (`src/`): roept rechtstreeks `storefront-api` aan (bv. `useCart`, `NewsletterSection`, `ShopCart`).
  - VanXcel-frontend (vanxcel.be, aparte repo): **sellqo-proxy** — bevestigd door 200-responses met VanXcel-data.
  - Andere externe frontends (Mancini Milano, demo storefront): niet vast te stellen vanuit deze repo; vereist los onderzoek in bijbehorende repo's of access-logs van `jpnacppdutjnasmuikgp`.

## 3. Conclusie + aanbeveling: Pad B

`storefront-api` is de moderne, gedocumenteerde, in deze repo onderhouden engine. `sellqo-proxy` is een legacy-adapter die:
- niet in git staat (deployment drift),
- op een ander Supabase-project draait,
- slechts een beperkte subset doorrouteert,
- geen eigen functionaliteit toevoegt (alleen contract-vertaling).

**Aanbeveling**:
1. VanXcel-frontend migreren naar het body-based `storefront-api`-contract.
2. Voor de `contact`-actie: toevoegen aan `storefront-api` of een dedicated publieke edge function bouwen.
3. Na migratie: `sellqo-proxy` op `jpnacppdutjnasmuikgp` deprecieren → verwijderen.

**Open follow-ups**:
- Bevestigen of andere frontends `sellqo-proxy` gebruiken (via access-logs van `jpnacppdutjnasmuikgp`).
- Source van `sellqo-proxy` alsnog ophalen uit het andere project of de bijbehorende repo.

---
*Rapport opgesteld op 2026-06-02. Zie `docs/checkout-api-contract.md` voor canonical API-contract.*
