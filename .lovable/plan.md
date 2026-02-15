
# Bevestigingsdialoog bij Theme Wissel

## Probleem

Wanneer je een ander thema selecteert, worden **alle handmatige aanpassingen** (kleuren, fonts, mood-instellingen) direct overschreven door de standaardwaarden van het nieuwe thema. Er is geen waarschuwing en geen manier om terug te gaan.

## Oplossing

Een **AlertDialog** tonen wanneer de gebruiker een ander thema aanklikt, met duidelijke uitleg dat alle huidige aanpassingen worden gereset. Pas na bevestiging wordt het thema gewisseld.

Als hetzelfde thema opnieuw wordt aangeklikt (al geselecteerd), gebeurt er niets — geen dialoog, geen reset.

## Wat de gebruiker ziet

Bij klik op een ander thema verschijnt een dialoog:

```
"Theme wijzigen?"

"Als je naar [Themanaam] wisselt, worden al je huidige
aanpassingen (kleuren, fonts, layout) gereset naar de
standaardwaarden van dit theme."

[Annuleren]  [Doorgaan]
```

## Technische Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `ThemeGalleryInline.tsx` | AlertDialog toevoegen met state voor `pendingThemeId`. Bij klik: als thema al actief is, niets doen. Anders: dialoog tonen. Bij bevestiging: `handleSelectTheme` uitvoeren. |
| `ThemeGallery.tsx` | Zelfde AlertDialog-logica toepassen (dit component wordt ook gebruikt op de volledige Theme-pagina). |

### Logica

1. Gebruiker klikt op een thema
2. Als `themeId === themeSettings.theme_id` -> niets doen (al geselecteerd)
3. Anders -> `setPendingThemeId(themeId)` om de dialoog te openen
4. Bij "Annuleren" -> `setPendingThemeId(null)`
5. Bij "Doorgaan" -> `handleSelectTheme(pendingThemeId)` uitvoeren en dialoog sluiten

Beide componenten gebruiken dezelfde aanpak met de bestaande `AlertDialog` UI-component.
