# Voorstellen (niet uitgevoerd)

Kant-en-klare wijzigingen die een beslissing van Akke nodig hebben. Niets hieruit draait vanzelf.
Uitvoeren via query_database (connector), daarna verifiëren met de controle onderaan elk bestand
en een entry in docs/role-audit.md.

- `sec-cost-1-kolomrechten-anon.sql` — inkoopprijzen (cost_price) niet meer publiek leesbaar.
- `bol-sync-1-verzendstatus.sql` — bol-orders komen correct op 'shipped', zonder eigen trackingmail naar marketplaceklanten.
