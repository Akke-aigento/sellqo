

# Avatar-initialen verwijderen uit conversatielijst

## Wat verandert

De avatar-cirkel met initialen (de "V" badge) wordt verwijderd uit de conversatie-items. Het kanaal-icoon, afzendernaam, onderwerp en preview blijven behouden.

De nieuwe layout per conversatie-item wordt:

```text
+------------------------------------------+
| [kanaal-icoon] Afzendernaam     3m geleden|
| Onderwerp van het bericht                 |
| [check] Preview van de inhoud...          |
+------------------------------------------+
```

## Technische details

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/inbox/ConversationItem.tsx` | Avatar + unread-dot verwijderen uit rij 1; kanaal-icoon + naam + tijd op dezelfde eerste rij |
| `src/components/admin/inbox/ConversationDragOverlay.tsx` | Avatar verwijderen, alleen naam + kanaal-icoon behouden |
| `src/components/admin/inbox/SelectableConversationItem.tsx` | Geen wijziging nodig (wraps ConversationItem) |

Geen database wijzigingen nodig.
