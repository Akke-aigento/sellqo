

## Fix: iOS context menu bij long-press + Terugzetten vanuit prullenbak

### Twee problemen

**1. iOS toont native context menu (copy/lookup) bij long-press**
De browser triggert standaard een context menu bij lang indrukken op tekst. Dit moet onderdrukt worden met CSS `-webkit-touch-callout: none` en `user-select: none` op het swipeable item, plus `e.preventDefault()` in de touch handler.

**2. Terugzetten vanuit prullenbak/archief ontbreekt in action sheet**
De `ConversationActionSheet` toont altijd Archiveren en Verwijderen, maar als een gesprek in de prullenbak of archief zit, moet er een "Terugzetten naar inbox" optie zijn. De swipe-acties moeten ook contextafhankelijk worden (in prullenbak: swipe rechts = terugzetten i.p.v. archiveren).

### Wijzigingen

| Bestand | Wat |
|---------|-----|
| `SwipeableConversationItem.tsx` | CSS `user-select: none` + `touch-callout: none` toevoegen op touch-container. `e.preventDefault()` in touchStart toevoegen. Nieuwe prop `currentFolder` om swipe-actie rechts contextueel te maken (restore vs archive). |
| `ConversationActionSheet.tsx` | Nieuwe prop `onRestore` + `currentFolder`. Toon "Terugzetten naar inbox" knop als gesprek in archief/prullenbak zit. Verberg "Archiveren" in archief-view. |
| `ConversationList.tsx` | Geef `currentFolder` en `onRestoreConversation` door aan SwipeableConversationItem en ActionSheet. |
| `Messages.tsx` | Voeg `restoreConversation` single-item handler toe (hergebruik bestaande bulk-restore logica voor 1 item). |

### SwipeableConversationItem CSS fix

```css
/* Op de touch-container div */
-webkit-touch-callout: none;
-webkit-user-select: none;
user-select: none;
```

Plus `e.preventDefault()` in `handleTouchStart` om iOS text-selection/callout te blokkeren.

### Action Sheet contextafhankelijk

- In prullenbak/archief: toon "Terugzetten naar inbox" bovenaan
- In prullenbak: verberg "Archiveren" (maakt geen zin)
- In archief: verberg "Archiveren" (zit er al in)

