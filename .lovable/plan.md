

# Eigen kleurkeuze toevoegen aan fotobewerker

## Wat
Naast de bestaande presets (Studio wit, Marmer, etc.) komt er een extra optie "Eigen kleur" met een kleurkiezer. De tenant kiest een hex-kleur en de AI krijgt als prompt: "Place this product on a solid [hex color] background".

## Aanpak

**Bestand:** `src/components/admin/products/ImageEditorDialog.tsx`

1. **Nieuwe preset toevoegen** aan `BACKGROUND_PRESETS`: `{ id: 'custom_color', label: 'Eigen kleur', icon: '🎨' }` — zonder vaste prompt (die wordt dynamisch opgebouwd).

2. **State toevoegen**: `customColor` string (default `#ffffff`).

3. **Kleurkiezer tonen**: Wanneer `selectedPreset === 'custom_color'`, verschijnt een `<input type="color" />` met een hex-tekstveld ernaast. Wordt getoond direct onder het preset-grid.

4. **Prompt dynamisch opbouwen** in `handleProcess`: als `custom_color` geselecteerd is, wordt de prompt `Place this product on a solid ${customColor} colored background, professional product photography with soft shadows`.

5. **Reset** bij sluiten: `customColor` terug naar default.

```text
Presets grid:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│🔲 Transp.│ │⬜ Wit    │ │🔳 Grijs  │ │🌈 Gradient│
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│🪵 Hout   │ │🏛️ Marmer │ │🌿 Natuur │ │❄️ Winter  │
├──────────┤
│🎨 Eigen  │  ← nieuw
└──────────┘

Als "Eigen kleur" geselecteerd:
┌─────────────────────────────────┐
│ [■ kleurpicker]  #FF6B35       │
└─────────────────────────────────┘
```

## Bestanden
- `src/components/admin/products/ImageEditorDialog.tsx` — enige wijziging

