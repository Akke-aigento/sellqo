
## Fix: Productbewerker layout op kleinere schermen

### Probleem
De huidige layout gebruikt `lg:grid-cols-[1fr_400px]` waardoor:
- Op schermen rond 1024-1280px de rechterkolom (400px vast) de hoofdinhoud te veel samenperst
- De afbeeldingen-sidebar nauwelijks zichtbaar is (afgesneden aan de rechterkant zoals in de screenshot)

### Oplossing

**Bestand: `src/pages/admin/ProductForm.tsx`**

1. **Breakpoint verhogen en sidebar flexibeler maken**: Wijzig de grid van `lg:grid-cols-[1fr_400px]` naar `xl:grid-cols-[1fr_380px]` zodat de 2-kolom layout pas activeert op schermen breder dan 1280px. Op kleinere schermen stacked alles netjes.

2. **Afbeeldingen-sectie naar boven op smalle schermen**: Op schermen waar de layout stacked (onder xl), de afbeeldingen-kaart boven de productdetails tonen met `order-first xl:order-none` op de rechterkolom. Zo ziet de gebruiker direct de productfoto's.

3. **Afbeeldingen-grid aanpassen**: Op de gestackte weergave het afbeeldingen-grid veranderen van `grid-cols-2` naar `grid-cols-3 sm:grid-cols-4 xl:grid-cols-2` zodat foto's efficienter horizontaal worden getoond wanneer de volle breedte beschikbaar is.

### Technische details

Regel 448 wijzigen:
```
grid grid-cols-1 lg:grid-cols-[1fr_400px]
```
wordt:
```
grid grid-cols-1 xl:grid-cols-[1fr_380px]
```

Regel 1018 (rechterkolom div) toevoegen:
```
order-first xl:order-none
```

Regel 1044 (afbeeldingen grid) wijzigen:
```
grid grid-cols-2
```
wordt:
```
grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-2
```

### Resultaat
- Op schermen onder 1280px: afbeeldingen verschijnen bovenaan, full-width, in een 3-4 kolom grid
- Op schermen boven 1280px: de bekende 2-kolom layout met sidebar rechts
- Geen content meer afgesneden of onzichtbaar
