

## Bundle Producten Koppelen — VanXcel

### Huidige staat
- **Tabel**: `product_bundle_items` (kolommen: `product_id`, `child_product_id`, `quantity`, `sort_order`, etc.)
- **Bestaande koppelingen**: Alleen TheSMALL 200Ah heeft 4 items (Converter 1000W, Battery 200Ah, Solar Panel, Mounting Kit). Alle andere bundels zijn leeg.
- **7 bundle producten** gevonden, waarvan "Build Your Power System" geen koppelingen nodig heeft.

### Ontbrekende producten in de database

De volgende child producten bestaan **nog niet** als los product:

| Product | Nodig voor |
|---|---|
| **Montagelijm** (Mounting Glue) | TheSMALL + TheBIG kits |
| **Krimpkousconnectoren** (Heat Shrink Connectors) | TheSMALL + TheBIG kits |
| **Automatische stroomonderbreker 200A** | TheBIG kits (alleen 100A en 150A bestaan) |
| **Zekeringhouder 8 sleuven** | TheBIG kits (alleen 6 en 12 slots bestaan) |

**Actie vereist**: Maak deze 4 producten eerst aan in SellQo voordat de TheBIG koppelingen compleet kunnen worden.

### Wat ik ga doen

**Stap 1**: Bestaande 4 koppelingen van TheSMALL 200Ah verwijderen en alle 6 bundels opnieuw volledig invullen.

**Stap 2**: Per bundel de volgende INSERT statements uitvoeren in `product_bundle_items`:

---

#### BUNDEL 1: TheSMALL 200Ah (`7d394548`)
| # | Child product | Qty |
|---|---|---|
| 1 | Converter 1000W (`07ac37b4`) | 1 |
| 2 | 200Ah Battery (`25778975`) | 1 |
| 3 | 150W Solar Panel (`38fdbff3`) | 1 |
| 4 | Mounting Kit (`3f8dac6e`) | 1 |
| 5 | Cable 6mm2 Solar Red (`b1352993`) | 1 |
| 6 | Cable 6mm2 Solar Black (`431acc28`) | 1 |
| 7 | Cable 2.5mm2 Red (`82990be2`) | 1 |
| 8 | Cable 2.5mm2 Black (`f7698b5c`) | 1 |
| 9 | Cable 35mm2 Red (`5f887b6e`) | 1 |
| 10 | Cable 35mm2 Black (`7cfe69e1`) | 1 |
| 11 | Battery Terminals Pack (`52443d03`) | 1 |
| 12 | Ring Terminals 35mm2 (`4a740382`) | 1 |
| 13 | Cable Gland Firewall (`89d5b465`) | 1 |
| 14 | Double Cable Gland Roof (`04ff12e6`) | 1 |
| 15 | Pack Fuses (`bb220bd8`) | 1 |
| 16 | Automatic Fuse 100A (`461c53c8`) | 1 |
| 17 | Fuse Holder 6 slots (`f9664d83`) | 1 |
| 18 | Switch Panel 5 Slots (`85515f2d`) | 1 |
| 19 | USB Wall Plug 2-Pack (`21f541de`) | 1 |
| 20 | EU Wall Plug 2-Pack (`a0347774`) | 1 |
| 21 | Powerstrip USB A+C (`7a704411`) | 1 |
| 22 | Cable Ties Pack (`898bbf8f`) | 1 |
| 23 | Heat Shrink Pack (`bd89e003`) | 1 |

**Ontbreekt**: Montagelijm, Krimpkousconnectoren

#### BUNDEL 2: TheSMALL 300Ah (`5d80e0cd`)
Zelfde als Bundel 1, maar met 300Ah Battery (`ef9dfa20`) ipv 200Ah.

#### BUNDEL 3: TheSMALL Powerstation (`0dcf911a`)
| # | Child product | Qty |
|---|---|---|
| 1 | 500W Powerstation (`e8116204`) | 1 |
| 2 | 150W Solar Panel (`38fdbff3`) | 1 |

#### BUNDEL 4: TheBIG 200Ah (`59348dee`)
Zelfde structuur als Bundel 1, maar met:
- Converter 1500W (`66921a49`) ipv 1000W
- Cable 50mm2 Red/Black ipv 35mm2
- Ring Terminals 50mm2 ipv 35mm2
- Solar Panel qty = **2** ipv 1
- **Ontbreekt**: Automatic Fuse 200A, Fuse Holder 8 slots, Montagelijm, Krimpkousconnectoren

#### BUNDEL 5: TheBIG 300Ah (`2d0dae8a`)
Zelfde als Bundel 4, maar met 300Ah Battery.

#### BUNDEL 6: TheBIG Powerstation (`2750c83f`)
| # | Child product | Qty |
|---|---|---|
| 1 | 1000W Powerstation (`98893d00`) | 1 |
| 2 | 150W Solar Panel (`38fdbff3`) | 2 |

---

### Aanpak

1. **Eerst**: Bestaande koppelingen verwijderen voor alle 6 bundels (clean slate)
2. **Dan**: Alle koppelingen inserten via de Supabase insert tool
3. **TheBIG kits**: Alles koppelen wat beschikbaar is; de 4 ontbrekende producten rapporteren zodat jij ze kunt aanmaken

### Vragen aan jou

Voordat ik de inserts uitvoer:
1. Kloppen de product-mappings hierboven?
2. Wil je dat ik de TheBIG kits **gedeeltelijk** koppel (zonder de 4 ontbrekende producten), of wacht je liever tot je ze hebt aangemaakt?
3. Voor TheBIG: moet ik **Fuse Holder 12 slots** gebruiken als tijdelijk alternatief voor de niet-bestaande 8 slots variant? En **Automatic Fuse 150A** als alternatief voor de niet-bestaande 200A?

