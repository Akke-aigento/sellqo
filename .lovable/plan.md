

## Inbox mobiel: Card-stijl verwijderen, clean layout zoals Producten

### Probleem
De Inbox op mobiel zit in een `Card` component met border, rounded corners en shadow. De Producten-pagina heeft dit niet — daar staat de content direct op de pagina zonder wrapper. Dat ziet er cleaner uit.

### Aanpak
Op mobiel de `Card` wrapper volledig verwijderen en de content direct renderen, zoals de Producten-pagina doet. Desktop behoudt de Card.

### Wijzigingen

| Bestand | Actie |
|---------|-------|
| `src/pages/admin/Messages.tsx` | Op mobiel Card vervangen door een gewone `div`, borders/shadow/rounded weg |

### Detail

**Messages.tsx — regel ~177**

Huidige code:
```tsx
<Card className={`h-full flex overflow-hidden ${isSinglePanel ? 'rounded-none border-x-0' : ''}`}>
```

Wordt:
```tsx
{isSinglePanel ? (
  <div className="h-full flex overflow-hidden border-t">
    {/* zelfde children */}
  </div>
) : (
  <Card className="h-full flex overflow-hidden">
    {/* zelfde children */}
  </Card>
)}
```

Op mobiel wordt het dus een simpele `div` met alleen een `border-t` als scheiding tussen header en content. Geen shadow, geen rounded corners, geen zijborders. Exact zoals de Producten-pagina content direct op de achtergrond rendert.

### Geen database wijzigingen nodig

