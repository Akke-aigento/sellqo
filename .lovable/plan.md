

# Productformulier: Van 9 tabs naar one-page layout

## Huidige situatie
Het productformulier heeft 9 tabs (Type, Basis, Prijzen, Voorraad, Afbeeldingen, Bestanden, Cadeaukaart, Marketplaces, SEO). Dit maakt het onoverzichtelijk en je moet veel heen-en-weer klikken.

## Nieuwe opzet: One-page met 2-koloms layout

Alle content komt op 1 scrollbare pagina, logisch gegroepeerd in cards. Alleen conditionele secties (Bestanden/Licenties, Cadeaukaart) en Marketplaces blijven als aparte tabs -- die zijn complex genoeg om apart te houden.

### Layout

```text
+------------------------------------------+
| Header + Opslaan knop                    |
+------------------------------------------+
| [Product]  [Marketplaces]                | <-- slechts 2 tabs
+------------------------------------------+
|                                          |
| LINKER KOLOM (60%)  | RECHTER KOLOM (40%)|
|                     |                    |
| [Product type]      | [Afbeeldingen]    |
| [Basisinfo]         | [Organisatie]      |
|   - Naam, Slug      |   - Categorie     |
|   - Korte beschr.   |   - Tags          |
|   - Volledige beschr| [Status]          |
| [Prijzen]           |   - Actief        |
|   - Verkoop/Inkoop  |   - Uitgelicht    |
|   - Vergelijking    |   - Verbergen     |
| [Voorraad & ID]     | [SEO]            |
|   - SKU, Barcode    |   - Meta titel    |
|   - Voorraad        |   - Meta beschr.  |
|   - Verzending      |   - Preview       |
|                     |                    |
| --- Conditioneel ---                     |
| [Digitale bestanden] (als digital)       |
| [Cadeaukaart config] (als gift_card)     |
+------------------------------------------+
```

### Voordelen
- Alles in 1 oogopslag zichtbaar
- Geen heen-en-weer klikken meer tussen 9 tabs
- Belangrijke info (naam, prijs, voorraad) altijd zichtbaar
- Marketplaces blijft apart (eigen complexe UI)
- Conditionele secties verschijnen automatisch onder de hoofdcontent

## Technische details

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/ProductForm.tsx` | Herstructureren: 9 tabs -> 2 tabs (Product / Marketplaces), product tab wordt one-page met 2-koloms grid |

### Concrete aanpak

1. **TabsList verkleinen**: Van `grid-cols-9` naar slechts 2 tabs: "Product" en "Marketplaces"
2. **Product tab**: Bevat alle huidige content in een `grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6` layout
3. **Linker kolom**: Product type selectie, Basisinfo (naam/slug/beschrijvingen), Prijzen, Voorraad/Identificatie/Verzending, en conditioneel Digitale bestanden of Cadeaukaart
4. **Rechter kolom**: Afbeeldingen, Organisatie (categorie + tags), Status toggles, SEO
5. **Marketplaces tab**: Blijft ongewijzigd als eigen tab

### Geen database-wijzigingen nodig
Alle data en velden blijven identiek -- dit is puur een UI-herstructurering.

