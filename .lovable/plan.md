
# Preview-blok voor ingeklapte beschrijving

## Wat verandert er
Wanneer de "Volledige beschrijving" collapsible dichtgeklapt is, wordt er een preview getoond van de bestaande inhoud: maximaal 8 regels tekst, met een fade-out effect onderaan. Zo zie je meteen of er al content is zonder de editor te hoeven openen.

## Aanpak
- Onder de `CollapsibleTrigger` (maar buiten de `CollapsibleContent`) een preview-blok toevoegen
- Dit blok is alleen zichtbaar als de collapsible **dicht** is en er content aanwezig is
- De HTML-content wordt als platte tekst gerenderd in een `<div>` met `max-h-[12rem] overflow-hidden` (ca. 8 regels) en een gradient fade-out onderaan
- Gebruik een `useState` voor open/closed state zodat we conditioneel de preview kunnen tonen

## Technische details

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/ProductForm.tsx` | State toevoegen voor open/dicht, preview-blok renderen wanneer dicht + content aanwezig |

### Concrete wijzigingen
1. Voeg `const [descOpen, setDescOpen] = useState(false)` toe
2. Gebruik `<Collapsible open={descOpen} onOpenChange={setDescOpen}>`
3. Buiten `CollapsibleContent`, als `!descOpen && field.value` heeft content, toon een preview-div:
   - Render de HTML in een `prose prose-sm` container met `max-h-[12rem] overflow-hidden`
   - Voeg een gradient overlay toe onderaan (`bg-gradient-to-t from-background to-transparent`)
   - Klikken op de preview opent de editor
