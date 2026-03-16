

## Plan: Kassamedewerkers integreren in teamleden-lijst + rollenuitleg opruimen

### Wat verandert

**1. Kassamedewerkers in dezelfde lijst als teamleden**

De `CashierManagement` is nu een apart blok onderaan — dat voelt als een losstaand systeem. In plaats daarvan integreren we kassamedewerkers direct in de teamleden-tabel:

- Kassamedewerkers verschijnen in dezelfde `Table` als gewone teamleden, met een `Kassa` badge
- In plaats van e-mail tonen ze "PIN-toegang" als subtekst
- De avatar gebruikt hun `avatar_color` met initialen (net als nu)
- De "Toevoegen" knop bovenaan wordt een dropdown/split: "Teamlid uitnodigen" of "Kassamedewerker toevoegen"
- De acties (drie-puntjes menu) voor kassamedewerkers tonen: Bewerken, PIN wijzigen, Activeren/Deactiveren — i.p.v. rol wijzigen
- Het aparte `CashierManagement` Card verdwijnt

**2. Rollenuitleg opruimen**

De huidige rollenuitleg card heeft inconsistent alignment — badge en tekst staan niet netjes uitgelijnd. Oplossing:

- Gebruik een grid-layout met vaste kolommen (badge | beschrijving) zodat alles netjes op één lijn staat
- Voeg "Kassa" toe als rol in de uitleg
- Verwijder de Engelse subtitels ("Tenant Admin", "Staff", etc.) — dat is verwarrend voor NL-gebruikers, de badge zegt al genoeg

### Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/settings/TeamSettings.tsx` | Kassamedewerkers integreren in teamleden-tabel, toevoeg-knop splitsen, rollenuitleg grid-layout |
| `src/components/admin/settings/CashierManagement.tsx` | Behouden maar alleen de dialogen (create/edit/PIN) exporteren, niet de hele Card |

