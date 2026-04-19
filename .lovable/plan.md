
Goede vraag — even checken: de nieuwsbrief-**configuratie** (provider, API keys, welkomstmail-instellingen in `tenant_newsletter_config`) blijft sowieso staan, want dat is een setting van de tenant.

Wat ik in het oorspronkelijke plan wél bij "verwijderen" had staan zijn de **abonnees** zelf (`newsletter_subscribers` — momenteel 1 record). Dat past bij "verse lei voor klanten".

Wil je dat ik die abonnee(s) tóch behoud?

## Aangepast reset-plan (nieuwsbrief volledig behouden)

**Extra BEHOUDEN naast eerder plan:**
- `tenant_newsletter_config` — provider + welkomstmail-instellingen (stond al op behouden)
- `newsletter_subscribers` — alle abonnees blijven staan ✅
- `email_unsubscribes` — uitschrijvingen blijven (anders kan een uitgeschreven persoon weer mails krijgen)

**Rest van het plan ongewijzigd** — alle orders, klanten (CRM), facturen, offertes, retouren, kortingen, POS-sessies, notificaties, ads-historie en logs worden nog steeds opgeschoond. Producten, categorieën, media en alle settings blijven intact.

## Bevestig
- **Ja, nieuwsbrief-abonnees behouden** → ik voer reset uit met bovenstaande aanpassing
- **Nee, abonnees ook wissen** → originele plan ongewijzigd uitvoeren (alleen de config blijft)

Welke wil je?
