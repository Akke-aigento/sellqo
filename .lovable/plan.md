

## Fix: Tabs op 2 nette rijen + professionele look

### Probleem
10 tabs in `overflow-x-auto` — de eerste tabs scrollen uit beeld, je ziet "uding" (afgekapt "Boekhouding"). Een boekhouder ziet dit en denkt: amateurwerk.

### Oplossing: Twee rijen met `flex-wrap`
Geen scrolling meer. De tabs wrappen netjes naar 2 rijen van 5. Alle tabs altijd zichtbaar, niks afgesneden.

### Technische aanpak

**`src/pages/admin/Reports.tsx`** regel 316:
- `TabsList` class van `flex w-full overflow-x-auto h-auto p-1 gap-1` naar `flex flex-wrap w-full h-auto p-1 gap-1`
- Dat is letterlijk 1 woord veranderen: `overflow-x-auto` → `flex-wrap`

Resultaat: 5 tabs op rij 1 (Financieel, Boekhouding, Facturen, Orders, Klanten), 5 op rij 2 (Producten, Voorraad, Abonnementen, Inkoop, Kassa). Alles zichtbaar, niks scrollen, professioneel.

