

## Fix: Product opslaan faalt + categorieën verdwijnen

### Probleem 1: "invalid input syntax for type uuid: elegant"

De database kolom `gift_card_design_id` is van type **UUID**, maar we slaan nu strings op zoals `"elegant"`, `"modern"`, etc. Dit veroorzaakt een 400 Bad Request bij het opslaan.

**Oplossing:** De kolom wijzigen van `uuid` naar `text` via een database migratie. Dit is de schoonste oplossing omdat de template-ID's nu strings zijn en geen verwijzing meer naar de `gift_card_designs` tabel.

```text
ALTER TABLE products 
  ALTER COLUMN gift_card_design_id TYPE text;
```

Als er een foreign key constraint bestaat naar `gift_card_designs`, moet die eerst verwijderd worden.

---

### Probleem 2: Categorieën verdwijnen nog steeds

Er zitten twee bugs in de category sync logica:

**Bug A:** De `useEffect` vereist `savedCategoryIds.length > 0`. Als een product geen categorieën heeft, wordt `categoriesInitialized` nooit `true`. Als je vervolgens categorieën toevoegt en opslaat, worden ze niet gesynchroniseerd want de guard in `onSubmit` checkt `categoriesInitialized`.

**Bug B:** Bij het **aanmaken** van een nieuw product is `isEditing` false, dus de `useEffect` draait nooit, `categoriesInitialized` blijft `false`, en de category sync in `onSubmit` wordt overgeslagen.

**Oplossing:** De logica aanpassen zodat:
- Bij **nieuw product** (`!isEditing`): `categoriesInitialized` direct op `true` zetten (er zijn geen bestaande categorieën om op te wachten)
- Bij **bewerken**: de guard aanpassen om ook te initialiseren als de query klaar is met laden (zelfs als het resultaat leeg is), in plaats van te wachten op `length > 0`

Concreet:
1. `categoriesInitialized` standaard op `true` zetten als `!isEditing`
2. In de `useEffect`: de conditie `savedCategoryIds.length > 0` vervangen door een check of de query klaar is met laden (bijv. `isCategoriesLoaded` of gewoon reageren op wanneer de data beschikbaar komt, ongeacht lengte)

---

### Samenvatting wijzigingen

| Bestand | Wijziging |
|---|---|
| Database migratie | `gift_card_design_id` kolom wijzigen van `uuid` naar `text`, foreign key verwijderen indien aanwezig |
| `src/pages/admin/ProductForm.tsx` | Category init fix: `categoriesInitialized` correct initialiseren voor zowel nieuwe als bestaande producten |

### Resultaat
- Product opslaan met een geselecteerd template-ontwerp werkt zonder fout
- Categoriekoppelingen blijven behouden bij het bewerken van producten
- Categorieën worden correct opgeslagen bij nieuwe producten
