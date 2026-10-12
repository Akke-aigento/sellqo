# Voorstellen (niet uitgevoerd)

Kant-en-klare wijzigingen die een beslissing van Akke nodig hebben. Niets hieruit draait vanzelf.
Uitvoeren via query_database (connector), daarna verifiëren met de controle onderaan elk bestand
en een entry in docs/role-audit.md.

- `sec-cost-1-kolomrechten-anon.sql` — inkoopprijzen (cost_price) niet meer publiek leesbaar.
- `bol-sync-1-verzendstatus.sql` — bol-orders komen correct op 'shipped', zonder eigen trackingmail naar marketplaceklanten.
- Branch `voorstel/storefront-resolve-fix` (RESOLVE-FIX-1) — `storefront-resolve` en `storefront-api` `resolve_domain`/`get_tenant` gaven altijd "Tenant not found" of een fout (select op `tenants.store_name` enz., die niet bestaan). De antwoordvorm blijft gelijk. Vingerafdruk na de deploy: `GET storefront-resolve?hostname=vanxcel.com` geeft de tenant terug in plaats van 404, en `GET storefront-api` geeft de stempel `RESOLVE-FIX-1`. Bevat ook alles van main (PROMO-FIX-1).
