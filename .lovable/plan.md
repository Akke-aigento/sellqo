

# Tablet: Mobiel-achtige Layout (Eén paneel)

## Wat verandert

De tablet-versie (768px - 1024px) gaat werken zoals de mobiele versie: **één paneel tegelijk** zichtbaar. De gebruiker ziet óf de gesprekkenlijst, óf het detail-paneel met een terugknop.

## Wijzigingen

### `src/pages/admin/Messages.tsx`

De huidige code behandelt tablet anders dan mobiel. Dit wordt samengevoegd:

- **`showList` en `showDetail`** logica aanpassen: nu alleen gebaseerd op `!isMobile`, wordt `!isMobile && !isTablet` (dus zowel mobiel als tablet toont één paneel)
- **`handleSelectConversation`**: ook op tablet naar detail-view schakelen
- **`handleBack`**: ook beschikbaar op tablet
- **Gesprekkenlijst breedte**: op tablet `flex-1` (volledig breed) in plaats van `w-60`
- **Header**: op tablet dezelfde compactere weergave als mobiel
- **`onBack` prop**: ook doorgeven aan `ConversationDetail` wanneer het tablet is

Concreet worden de volgende regels aangepast:

| Regel | Huidige situatie | Wordt |
|-------|-----------------|-------|
| `showList` / `showDetail` (r148-149) | Alleen mobiel toont één paneel | Mobiel **en** tablet tonen één paneel |
| `handleSelectConversation` (r76) | Alleen bij `isMobile` naar detail | Bij `isMobile \|\| isTablet` naar detail |
| Gesprekkenlijst breedte (r219) | Tablet krijgt `w-60` | Tablet krijgt `flex-1` (volledig breed) |
| Header (r153-163) | Compact alleen op mobiel | Compact op mobiel **en** tablet |
| `onBack` prop (r270) | Alleen op mobiel | Op mobiel **en** tablet |

### Geen wijzigingen nodig in andere bestanden

`ConversationDetail.tsx` heeft al de `onBack` prop en terugknop-logica ingebouwd. Die werkt automatisch goed wanneer de prop wordt meegegeven.

## Resultaat

- **Mobiel (< 768px)**: Eén paneel, zoals nu -- geen verandering
- **Tablet (768px - 1024px)**: Eén paneel, met gesprekkenlijst over volle breedte en detail-paneel met terugknop
- **Desktop (> 1024px)**: Drie kolommen -- geen verandering
