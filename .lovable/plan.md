
# Rich Text Editor voor Productbeschrijving

## Probleem
De "Volledige beschrijving" in het productformulier is nu een simpele `<Textarea>`. Bij beschrijvingen tot 5000 tekens is dat onwerkbaar -- geen opmaak, geen structuur, geen visuele controle.

## Oplossing
Vervang de `<Textarea>` door een volwaardige TipTap rich text editor met een uitgebreide toolbar. Het project heeft al een `RichTextEditor` component (`src/components/admin/storefront/RichTextEditor.tsx`) en TipTap is volledig geinstalleerd (inclusief `@tiptap/extension-underline` via starter-kit).

### Nieuwe component: `ProductDescriptionEditor`
Een nieuwe, uitgebreidere variant specifiek voor productbeschrijvingen, met extra features bovenop de bestaande editor:

**Toolbar functies:**
- **Tekststijl**: Vet, Cursief, Onderstrepen, Doorhalen, Code
- **Koppen**: H2, H3, H4
- **Lijsten**: Opsommingslijst, Genummerde lijst
- **Blokken**: Citaat, Horizontale lijn
- **Links**: URL invoegen/bewerken
- **Afbeeldingen**: URL-based afbeelding invoegen
- **Undo/Redo**: Ongedaan maken en opnieuw
- **Tekenteller**: Live teller die HTML-tags negeert (telt alleen platte tekst), waarschuwt bij >4500 tekens en blokkeert bij 5000

### Wijzigingen

| Bestand | Actie | Details |
|---------|-------|---------|
| `src/components/admin/products/ProductDescriptionEditor.tsx` | **Nieuw** | Rich text editor met toolbar, tekenteller, en 5000-teken limiet |
| `src/pages/admin/ProductForm.tsx` | **Wijzig** | Vervang `<Textarea>` door `<ProductDescriptionEditor>` voor het description veld |
| `src/pages/admin/ProductForm.tsx` | **Wijzig** | Pas zod-validatie aan: verwijder `.max(5000)` op schema-niveau (validatie zit nu in de editor zelf op platte-tekst basis) |

### Technische details

**Opslag**: De description wordt opgeslagen als HTML-string in de bestaande `text` kolom in de database. Dit vereist geen database-wijziging.

**Zod-schema aanpassing**: De huidige `.max(5000)` validatie telt HTML-tags mee, wat oneerlijk is. De editor zelf zal de platte-tekst lengte bijhouden en visueel feedback geven. De zod-validatie wordt verruimd (bijv. `.max(20000)`) om ruimte te laten voor HTML-opmaak.

**Dependencies**: Geen nieuwe packages nodig. Alles is al beschikbaar via `@tiptap/starter-kit` en `@tiptap/react`.

**Karakter-teller logica**:
- Telt `editor.getText().length` (platte tekst, geen HTML)
- Groen bij < 4500 tekens
- Oranje waarschuwing bij 4500-4999 tekens
- Rood bij 5000 tekens
