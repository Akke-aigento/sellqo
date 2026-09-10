---
name: sellqo-gedeelde-paden
description: Regressie-preventie voor het sellqo-project bij werk aan gedeelde
  codepaden — functies, mailtemplates, PDF-generatoren, hooks of edge functions
  die MEER dan één "wereld" bedienen (abonnement vs klant, meerdere doc-types,
  meerdere marketplaces, platform vs tenant). Altijd toepassen wanneer een
  wijziging een functie raakt die door verschillende soorten data of gebruikers
  wordt aangeroepen. Elke regel is betaald met een productie-regressie op 6
  augustus 2026.
---

# SellQo Gedeelde-Paden — Regressie-Preventie

**Scope: enkel het project `sellqo`. Bij andere projecten in deze workspace:
negeer deze skill, tenzij expliciet gevraagd.**

Op één dag braken drie ongerelateerde dingen door dezelfde grondoorzaak: een
**gedeeld codepad dat meerdere werelden bedient**, waar een wijziging of aanname
voor wereld A wereld B raakte. Deze skill vangt dat patroon. Elke regel staat
mét het litteken.

## De grondoorzaak in één zin
Een functie die door meer dan één soort data of gebruiker wordt aangeroepen,
mag nooit aannemen dat elke aanroeper op wereld A lijkt. De duurste bugs zitten
niet in nieuwe code maar in bestaande code die plots een tweede consument krijgt.

## G1 — Wijzig je een gedeelde functie, inventariseer eerst ÁLLE consumenten
Vóór je een `select`, conditie, template of parameter aanpast in een functie die
meerdere types bedient: `grep` alle aanroepers én alle datatypes die er
doorheen lopen. Lijst ze op. Test je wijziging tegen ELK type, niet enkel het
type waarvoor je bouwt. Als je niet zeker weet hoeveel werelden een functie
bedient, weet je niet genoeg om hem te wijzigen.
**Incident:** `get-document-url` kreeg bij 2a·4 een `customer_id`-select erbij
voor billing-documenten. Die kolom bestaat niet op `shipping_labels` — één van
de vier doc-types die dezelfde functie bedient. Gevolg: elke labelprint 500'de
(`column shipping_labels.customer_id does not exist`), live gevonden op VanXcel
#1163. De fix voor doc-type A brak doc-type B, D en C.
**Regel:** een `select` of autorisatiepad in een multi-type-functie moet expliciet
per type gescoped worden (bv. `HAS_CUSTOMER_ID: Record<DocType, boolean>`).

## G2 — Kies de mailvariant op de DATASTRUCTUUR, nooit op de status alleen
Status (`paid`, `processing`) zegt niks over wélke soort factuur/mail het is.
Het onderscheid abonnement-vs-klant, platform-vs-tenant, mandaat-vs-los zit in
de **structuur** (`subscription_id IS NOT NULL`, `order_id`, prefix), niet in de
status. Tekst die één wereld belooft ("geïncasseerd via je machtiging") mag enkel
verschijnen als de structuur die wereld hard bevestigt.
**Incident:** `send-invoice-email` koos de incasso-mailtekst puur op
`status === 'paid' || 'processing'`. Een betaalde VanXcel-KLANTfactuur
(INV-2026-0155, webshopklant zonder enige machtiging) kreeg daardoor
"het bedrag wordt automatisch geïncasseerd via de door jou verstrekte machtiging
— deze factuur is voldaan". Een leugen richting de klant. Fix: conditie hangt nu
aan `invoice.subscription_id != null`.
**Regel:** klant-facing belofte = harde structurele conditie, geen status-proxy.

## G3 — "Werkt al maanden" betekent: zoek de trigger, niet de logica
Een keten die lang werkt en dan stilvalt is bijna nooit kapotte kernlogica — het
is een **transient** (async timeout, gemiste statusupdate, een gereverteerde
scheduler) of een externe realiteit die niet naar de DB is teruggeschreven.
Kom NIET aan een moeilijk-geconfigureerde, bewezen-werkende integratie (Bol-API,
Peppol, Odoo, Stripe Connect) op verdenking. Recon eerst read-only: draait de
cron écht (indexed `runid`-query, niet `start_time`)? Wat zegt de externe
partij? Wat zegt onze rij?
**Incident:** Bol auto-accept "was stuk" — bleek: order was bij Bol al
`shipped` (bevestiging kwam door), maar onze `sync_status` bleef lokaal op
`accepted` hangen doordat `confirm-bol-shipment` ná Bol's acceptatie op een
async poll-timeout struikelde vóór de lokale statusupdate. Eén statusveld
rechtzetten loste het op. De vorige keer (22 juni) was het een gereverteerde
`marketplace-sync-scheduler`. Nooit de accept-logica zelf, nooit de API-config.
**Regel:** bij "valt af en toe uit" → verifieer de trigger en de externe status
read-only; corrigeer één rij; laat de bewezen keten met rust.

## G4 — Broncode ≠ gedeployde werkelijkheid
Wat in de repo staat is niet bewijs van wat er live draait. Een verse `grep` op
de broncode toont intentie, niet realiteit — zeker bij schedulers en edge
functions die stilletjes gereverteerd of niet-gedeployd kunnen zijn.
Verifieer live gedrag: draaide de functie echt (sync-sporen in de data,
`deployed_at`, run-details), niet enkel "de code ziet er goed uit".
**Incident:** de scheduler-broncode triggerde `sync-bol-orders` correct, maar de
échte diagnose kwam pas uit de order-rijen zelf (`sync_status`, `updated_at`) en
uit Bol's antwoord — niet uit de code. (Zie ook engineering-rules R6: deploy
verifiëren.)

## Checklist bij werk aan een gedeeld pad
- [ ] Hoeveel werelden bedient deze functie? (doc-types, factuur-soorten,
      marketplaces, platform/tenant) — allemaal benoemd?
- [ ] Grep alle aanroepers + alle datatypes die er doorheen lopen
- [ ] Wijziging getest/doordacht tegen ELK type, niet enkel het doeltype
- [ ] Klant-facing tekst hangt aan een structurele conditie, niet aan status
- [ ] Bij "werkt al maanden, nu stuk": trigger + externe status read-only
      geverifieerd vóór enige wijziging; bewezen integratie niet aangeraakt
- [ ] Diagnose gebaseerd op live data/gedrag, niet enkel op broncode

