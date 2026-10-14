---
name: sellqo-prospect-demo
description: Een demowinkel op maat van een prospect bouwen (zijn zaak, zijn producten, zijn stijl) om hem over de streep te trekken. Gebruiken bij "maak een demo voor <zaak>" of een aanvraag via "Vraag je demo aan" op sellqo.app/voorbeelden.
---

# Demo op maat voor een prospect

Doel: de prospect ziet zijn eigen zaak op SellQo, met zijn producten, in een passend thema, en kan zelf rondklikken en een testbestelling doen. Dat gebeurt vóór hij iets beslist. Bouwt op de generator van `sellqo-demo-tenant` (`scripts/demo-seeds/`). Lees die skill voor de techniek.

## 1. Intake (kort, met Akke)
- Zaaknaam, sector (webshop, horeca of events), stad, en de website of menukaart als bron.
- 8 tot 15 producten: naam, prijs, korte omschrijving. Voor horeca ook allergenen en extra's (formaat, saus, bijgerecht). Varianten (maat, kleur, inhoud) waar dat past.
  - Heeft de zaak een website, dan stel je een eerste lijst op via WebFetch en laat je Akke die bevestigen.
  - Prijzen en namen neem je over zoals ze publiek staan. Verzin geen claims ("bekroond", "sinds 1950") die je niet kan aanwijzen.
- Thema: kies de preset die het best past (kleding, bloemen, restaurant, bistro, bar, tech, beauty, wijn, koffie, concertzaal, festival). Zet `color` op de huisstijlkleur van de zaak.
- **Logo en eigen foto's alleen met akkoord van de zaak.** Zonder akkoord: gegenereerde foto's in hun stijl, en de naam enkel als tekst.

## 2. Bouwen
1. Slug `demo-<zaak>` (kort, kleine letters). Kijk eerst of hij vrij is: `select slug from tenants where slug like 'demo-%'`.
2. Voeg de winkel toe aan `scripts/demo-seeds/spec_prospects.py` (zelfde formaat als `spec.py`).
3. Draai `python3 gen.py spec_prospects`, commit en push. Zet geen persoonsgegevens van de prospect in de repo: die is publiek. Zaaknaam, publieke producten en prijzen mogen wel.
4. Voer uit via GitHub raw met een md5-controle, zoals in `sellqo-demo-tenant`. Daarna de foto's: ±12 beelden, ±70 credits.
5. Zet in `ops.demo_shops.note`: `prospect: <zaak>, contact via <Akke>, offline na <datum + 30 dagen>`.

## 3. Controleren en opleveren
- `net.http_get` op de home, een productpagina en, bij horeca, `/menu?tafel=4`. Doe één testbestelling via `ops.sf`.
- De aankondigingsbalk "Demowinkel van SellQo…" blijft altijd staan. De juridische pagina's zeggen dat het een voorbeeld is.
- Geef Akke de link plus een kort bericht om door te sturen. Bijvoorbeeld: "Ik heb je zaak eens in SellQo gezet: https://demo-<zaak>.sellqo.shop. Klik gerust rond en bestel iets, er wordt niets aangerekend. Zin om samen te kijken wat je ervan vindt?"

## 4. Opvolgen
- **Na 30 dagen zonder akkoord:** offline zetten (`update tenant_theme_settings set shop_live = false where tenant_id = …`). Verwijderen alleen met Akke's expliciete go.
- **Tekent de prospect:** hij maakt zijn echte account via de gewone signup. Zijn producten zet je over via de product-export en -import (CSV). Een omzetknop "demo naar echte winkel" bestaat nog niet. Beloof die niet als iets dat al werkt.
- Noteer de demo en de afloop in `docs/role-audit.md` (sectie prospects).
