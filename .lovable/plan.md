

## Fulfillment orders als klikbare kaarten i.p.v. tabel

### Idee
De mobile weergave (regel 484-512) gebruikt al **kaart-elementen** — die zijn duidelijk klikbaar en werken intuïtief. Op desktop wordt nu een `<Table>` gebruikt met `cursor-pointer`, maar dat voelt niet als een klikbaar element. 

De oplossing: **vervang de desktop-tabel ook door kaart-elementen**, vergelijkbaar met de mobile versie maar met meer info op een rij. Dit geeft een uniform, klikbaar gevoel op elk scherm.

### Aanpak in `Fulfillment.tsx`

**Verwijder de hele `<Table>` desktop-sectie** (regels 515-640) en vervang door een grid/lijst van klikbare kaarten die op desktop meer kolom-info tonen:

Elke order-kaart bevat:
- **Linkerkant**: checkbox (met stopPropagation) + ordernummer + klantnaam + adres-preview
- **Midden**: status badge + item count + marketplace badge + tijdstempel
- **Rechterkant**: tracking info + ⋮ dropdown menu
- **Hover-effect**: `hover:border-primary/50 hover:shadow-sm transition` — duidelijk visueel signaal dat het klikbaar is
- Hele kaart = `onClick={() => openSheet(order.id)}`

Op mobiel blijft de bestaande compacte kaart-layout. Op desktop worden de kaarten breder met de info horizontaal uitgespreid (flex-row i.p.v. flex-col).

### Resultaat
- Geen tabel meer, alleen klikbare kaarten
- Duidelijke hover/active states
- Checkbox blijft werken (stopPropagation)
- ⋮ menu blijft voor snelle acties
- Uniform op mobile en desktop

