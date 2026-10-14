# Demo-seeds (DEMO-3)

Generator voor de publieke demowinkels op `<slug>.sellqo.shop`.

- `spec.py`: de winkels (producten, varianten, extra's, verzending, teksten, fotoprompts).
- `gen.py`: maakt per winkel `out/<slug>.data.sql`, `.theme.sql` en `.img.sql`, plus `out/presets.json` (themapresets voor `sellqo-storefront/src/theme/schema.json`).
- UUID's zijn deterministisch (uuid5 op de slug). Een tweede run geeft dus dezelfde ID's.

Uitvoeren in de live-DB, zonder te plakken: de DB haalt het bestand op via GitHub raw (`net.http_get`), je controleert de md5 tegen de lokale versie, en voert het dan uit met `EXECUTE`. Zie role-audit DEMO-3. Er staan geen secrets in deze bestanden: de repo is publiek.
