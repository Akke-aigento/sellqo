
# Fix: Avatar-initialen en kanaal-icoon zichtbaarheid

## Probleem 1: "V<" als initialen

De `customer.name` bevat waarschijnlijk het volledige "From"-header formaat, zoals `VanXcel <noreply@sellqo.app>`. De initials-logica splitst op spaties en pakt de eerste letter van elk woord, wat resulteert in "V" + "<" = "V<".

### Oplossing

Voor het berekenen van initialen, eerst het email-gedeelte strippen uit de naam:

```typescript
const cleanName = (customer?.name || '')
  .replace(/<[^>]*>/g, '')  // Strip <email@...>
  .trim();

const initials = cleanName
  ? cleanName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  : '?';
```

Dezelfde schone naam ook gebruiken voor de weergave op regel 2 (afzendernaam):
```typescript
{cleanName || customer?.name || 'Onbekend'}
```

### Bestand: `src/components/admin/inbox/ConversationItem.tsx`

---

## Probleem 2: Kanaal-icoon niet zichtbaar genoeg

Het kanaal-icoon (Mail/MessageSquare) staat nu naast de timestamp als een klein 3x3 icoontje. Dit maakt het onduidelijk welk kanaal is gebruikt.

### Oplossing

Het kanaal-icoon verplaatsen naar de afzendernaam-regel (rij 2), met een duidelijke kleur per kanaal:

- Email: Mail icoon in standaard kleur
- WhatsApp: MessageSquare in groen
- Facebook: Facebook icoon in blauw
- Instagram: Instagram icoon in paars/roze

Layout wordt:

```
[Avatar]                           3m geleden
[kanaal-icoon] Afzendernaam
Onderwerp van het bericht
[check] Preview van de inhoud...
```

### Bestand: `src/components/admin/inbox/ConversationItem.tsx`

Wijzigingen:
- Rij 1: Kanaal-icoon weghalen, alleen Avatar + tijd
- Rij 2: Kanaal-icoon toevoegen voor de afzendernaam, met kleur per kanaal (h-4 w-4 in plaats van h-3 w-3)

---

## Dezelfde fix toepassen op DragOverlay

De `ConversationDragOverlay.tsx` heeft dezelfde initials-logica en moet dezelfde cleanup krijgen.

### Bestand: `src/components/admin/inbox/ConversationDragOverlay.tsx`

---

## Technische samenvatting

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/ConversationItem.tsx` | Initialen cleanen (strip email), kanaal-icoon naar afzendernaam-rij met kleur |
| `src/components/admin/inbox/ConversationDragOverlay.tsx` | Initialen cleanen (strip email) |

Geen database wijzigingen nodig.
