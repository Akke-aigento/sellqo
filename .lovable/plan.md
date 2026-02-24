

## Verwijder de "Opnieuw Publiceren" knop

### Waarom

De knop "Opnieuw Publiceren" in de Webshop header zet alleen een `is_published` vlag in de database op `true` en update een timestamp. Zodra de webshop eenmaal gepubliceerd is, heeft de knop geen effect meer. De echte deployment gebeurt via de Lovable Publish-knop. De knop is daarom overbodig en kan verwarrend zijn.

### Wat verandert er

**Bestand: `src/pages/admin/Storefront.tsx`**

- De "Opnieuw Publiceren" / "Publiceren" `<Button>` verwijderen (regels 95-101)
- De `publishStorefront` import uit `useStorefront()` verwijderen
- De `Rocket` icon import verwijderen (wordt niet meer gebruikt in de header)
- De Live/Draft badge en Preview-link blijven behouden zodat je in een oogopslag ziet of de webshop live staat

De header wordt dan:

```text
Webshop                              [Live badge]  [Preview knop]
Beheer je online webshop...
```

In plaats van:

```text
Webshop                    [Live badge]  [Preview knop]  [Opnieuw Publiceren]
Beheer je online webshop...
```

### Opmerking

De `publishStorefront` mutatie in `useStorefront.ts` wordt ook nog gebruikt in `ThemeWizard.tsx`. Die blijft daar bestaan voor de eerste publicatie vanuit de Theme Wizard flow. Alleen de knop in de Storefront header wordt verwijderd.
