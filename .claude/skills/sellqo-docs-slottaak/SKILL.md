---
name: sellqo-docs-slottaak
description: Documentatie-slottaak (DOCS-1) voor het sellqo-project. Altijd toepassen bij elke nieuwe feature, gewijzigde feature of verwijderde feature — bepaalt de verplichte doc_articles-update voor de AI-hulpchatbot, inclusief doc_level-keuze (tenant vs platform), context_path en schrijfstijl.
---

# DOCS-1 — Documentatie-slottaak voor de AI-hulpchatbot

De hulpchatbot in SellQo beantwoordt vragen uitsluitend op basis van `doc_articles`. Documentatie die niet bestaat = vragen die de bot niet kan beantwoorden. Daarom is dit een **verplichte slottaak** bij elke feature-wijziging, gelijkwaardig aan de role-audit- en changelog-slottaken.

## Wanneer toepassen

Bij ELKE batch die een feature toevoegt, wijzigt of verwijdert die zichtbaar is in de UI:

- **Nieuwe feature** → nieuw `doc_articles`-artikel aanmaken
- **Gewijzigde feature** → bestaand artikel bijwerken (zoek op slug of context_path)
- **Verwijderde feature** → artikel op `is_published=false` zetten (nooit hard deleten)
- **Puur technische wijziging zonder UI-impact** (refactor, performance, security-hardening) → geen doc-update nodig, vermeld dit expliciet als "DOCS-1: n.v.t." in de afronding

## doc_level-keuze (kritisch — nooit fout doen)

- **`doc_level='tenant'`** — alles wat een tenant-gebruiker kan zien of gebruiken. Dit is de kennisbank van de hulpchatbot voor tenants.
- **`doc_level='platform'`** — alles wat uitsluitend voor platform-admins is (platform-dashboard, tenant-beheer, platform-billing, interne tooling). **Platform-informatie mag NOOIT in een tenant-artikel terechtkomen** — tenants mogen niet weten dat de platform-admin-laag bestaat.

Twijfel? Dan `platform`. Een gemiste tenant-doc is een onbeantwoorde vraag; een gelekte platform-doc is een security-incident.

## Verplichte velden per artikel

- `title` — vraag- of taakgericht ("Hoe koppel ik…", "X gebruiken")
- `slug` — kebab-case, stabiel, nooit hergebruiken voor ander onderwerp
- `excerpt` — één zin die de inhoud samenvat
- `content` — HTML (h2/h3, p, ul/ol, strong); zie schrijfstijl hieronder
- `context_path` — de admin-route waar de feature leeft (bv. `/admin/orders/invoices`); NULL alleen voor route-onafhankelijke onderwerpen
- `category_id` — bestaande categorie; alleen een nieuwe categorie aanmaken als geen enkele past
- `tags` — 2–5 zoektermen die een gebruiker zou intikken

## Schrijfstijl

- Nederlands, gericht aan de winkeleigenaar ("je/jouw"), geen technisch jargon
- Concrete stappen en menu-paden (**Instellingen → BTW**), geen code, geen API-details, geen databasetermen
- Vermeld bij plan-gebonden features altijd **vanaf welk abonnement** de feature beschikbaar is (Free / Starter / Pro / Enterprise) — de chatbot gebruikt dit voor upgrade-advies
- Idempotent schrijven naar de database: `ON CONFLICT (doc_level, slug) DO UPDATE`

## Afronding

Vermeld in elke batch-afronding welke doc_articles zijn aangemaakt/bijgewerkt (slugs), of expliciet "DOCS-1: n.v.t." met reden.

