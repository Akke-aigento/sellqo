## ALLERGEEN-VERKLAARD-1 — "bevat geen allergenen" is niet meer hetzelfde als "niet ingevuld" — 2 november 2026

Branch `night-api`. Contract voor de storefront: `docs/nachtrun/API-CONTRACT.md` §5.

**Root cause**
- `products.allergens` is `text[] not null default '{}'` (`20261014020000_allergen_1.sql`). Een lege
  lijst betekent zowel "nog niet ingevuld" als "bevat niets". `foodInfo()` in
  `supabase/functions/storefront-api/index.ts` laat een lege lijst weg, dus het menu kan het verschil
  niet tonen. Voor verkoop op afstand (EU 1169/2011) mag een zaak niet de indruk wekken dat een
  gerecht allergeenvrij is als niemand het nagekeken heeft.
- Live (01-11-2026, read-only nagetrokken): 344 producten, waarvan 67 met minstens één allergeen.

**Uitgevoerd**
- `supabase/migrations/20261101230340_allergeen_verklaard_1.sql`:
  - `products.allergens_declared boolean not null default false` (additief).
  - Backfill: `true` waar al minstens één allergeen staat, met een vaste tijdsgrens
    (`created_at <= '2026-11-02 00:00+01'`) zodat een herhaling niets anders raakt.
  - Trigger `products_allergens_declared` (BEFORE INSERT / UPDATE OF allergens, allergens_declared):
    staat er minstens één allergeen, dan wordt `allergens_declared` true. Dat geldt voor elk pad dat
    schrijft (productformulier, Kaart, `kaart_duplicate_product`, imports, AI-assistent). Bij een lege
    lijst blijft de waarde staan die de schrijver meegeeft.
- `storefront-api/index.ts`:
  - `foodInfo`: extra `allergens_declared: true`, enkel als de kolom true is. Anders geen sleutel, dus
    de respons blijft byte-gelijk (rooktest controleert `{}` voor leeg/false).
  - `get_product` gebruikt al `select('*')` en leest de kolom vanzelf. Voor de rest is de mapping expliciet:
    de ruwe rij gaat nooit door.
  - `get_products` selecteert de kolommen expliciet. De hoofdquery is **ongewijzigd** gelaten. Er is een
    aparte, foutbestendige lees bijgekomen (`select('id, allergens_declared') … .in('id', pagina-ids)
    .eq('allergens_declared', true)`). Vóór de migratie faalt die stil en verandert er niets; zo kan
    een te vroege deploy de catalogus van de zes custom frontends nooit breken.
  - Versiestempel `ALLERGEEN-VERKLAARD-1` (GET) en `allergeen-verklaard-1` (header). De tests in
    `event409`, `tableCheckPay` en `qrStatus` zijn mee aangepast (grep op de oude stempel: 0 treffers).
- Admin `src/components/admin/storefront/food/ProductAllergensCard.tsx`:
  - Nieuw vinkje **"Bevat geen van de 14 allergenen"** onder de 14 allergenen.
  - Aanvinken bewaart een lege lijst met `allergens_declared = true`, uitvinken bewaart `false`.
  - Het vinkje is uitgeschakeld zolang er een allergeen aangevinkt staat, met uitleg erbij.
  - Een allergeen aanvinken bewaart `true`. Het laatste allergeen weghalen bewaart `false`: het product
    is dan weer "niet ingevuld" en wordt nooit stil "bevat geen".
  - De hint "niets aangevinkt" toont enkel nog als het product niet verklaard is.
  - Het id van het vinkje bevat het product-id, zodat meerdere kaarten op één scherm elk hun eigen label hebben.
- i18n, in 5 talen: nieuw `admin.storefront.food.allergens_none_label` en `allergens_none_disabled`.
  Aangepast: `allergens_none_hint`, dat nu "nog niet ingevuld" zegt en naar het vinkje verwijst.

**Security-keuzes**
- Geen RLS, policies of grants geraakt.
- De triggerfunctie is niet `security definer` en heeft een vaste `search_path`; execute is ingetrokken
  voor public, anon en authenticated.
- `allergens_declared` is geen gevoelig gegeven. De kolom staat op `products`, niet op
  `tenant_theme_settings`.

**Gedeelde-paden-waarschuwing**
- `storefront-api` is gedeeld met de zes custom frontends. Er komt enkel een nieuwe sleutel bij, en
  alleen bij verklaarde producten.
  - Na de backfill zijn dat de producten mét allergenen: daar komt `allergens_declared: true` naast de
    bestaande `allergens`. Een frontend die die sleutel niet kent, negeert hem.
  - Geen bestaande sleutel wijzigt. De hoofdquery van `get_products` is byte-gelijk.
- Live nagetrokken (01-11-2026, read-only): van de zes tenants met `use_custom_frontend` heeft geen enkel
  product een allergeen (Astra Sleep, Benny Rich, Loveke, Mancini Milano, VanXcel, Zona Dorata: 0). Na
  de backfill krijgt dus geen enkel product van hen de nieuwe sleutel; hun respons blijft byte-gelijk.
  Het vinkje kunnen zij in de admin wel zetten. Dan verschijnt de sleutel, wat additief is.

**Verificatie**

| Controle | Uitkomst |
|---|---|
| `deno check` storefront-api | exit 0 |
| Nieuw `scripts/promo-compare/allergenDeclared.test.ts` | 3/3 (get_products: verklaard-geen / onbekend / met allergeen / oude rij zonder kolom; get_product; stempel) |
| `qrStatus`, `tableRequest`, `tableCheckPay`, `event409`, `resolve`, `billingLock`, `ticketResend` | groen |
| Rooktest `smoke.ts` (uitgebreid met twee `foodInfo`-asserties) | groen |
| Nieuw `src/components/admin/storefront/food/ProductAllergensCard.test.tsx` | 3/3 |
| Afgebakende `tsc` op de kaart + test | exit 0 |
| Lint | 241 vóór = 241 na; nieuwe bestanden en harnas-scenario 0 |
| `i18n-parity` | exit 0 |

- Harnas `scripts/harness/scenarios/allergenen` (nieuw, drie standen) op 390 en 1280 px:
  - standen `["unchecked","checked","unchecked/uit"]`;
  - aanvinken bewaart `{allergens: [], allergens_declared: true}`;
  - geen overloop.
- Screenshots staan in `/tmp/harness/allergenen-{390,1280}[-na-aanvinken].png`.
- De eerste `shoot.mjs`-run haalt de 30 s soms niet (koude vite-start); de tweede run lukt.

**Bewust ongemoeid / Vervolg**
- **Kaart (bouwer ADMIN):**
  - `KaartProductSheet` gebruikt dezelfde `ProductAllergensCard`, dus het vinkje staat er vanzelf.
    Geen enkel bestand in `src/components/admin/horeca/kaart/*` is gewijzigd.
  - Wel nodig daar: de teller in de sheet (`admin.kaart.sheet.allergenCount`) toont enkel een aantal.
    Een "geen"- of "niet ingevuld"-aanduiding zou passen (`useKaart` selecteert `allergens_declared`
    dan nog niet).
  - Ook nodig: `kaart_duplicate_product` (SQL, `20261024210000_kaart_3_menu_order.sql`) kopieert
    `allergens_declared` niet. Een gekopieerd "bevat geen"-gerecht wordt dus "niet ingevuld". Dat is
    veilig (niets beweren), maar onhandig. Fix: `allergens_declared` meenemen in die insert.
- **Allergenenkaart** (`AllergenChart`, Bestellen › Allergenen, afdrukbaar): toont geen verschil tussen
  "geen" en "niet ingevuld". Voorstel: een rij zonder bolletjes en niet verklaard krijgt "?" of "niet
  ingevuld".
- **Storefront (sellqo-storefront):** tonen volgens de tabel in het contract §5.
- `doc_articles`: het helpartikel over allergenen kan één zin over het nieuwe vinkje krijgen. Niet
  gedaan, want de live slug en tekst moeten eerst nagetrokken worden voor een md5-guard.

**Uitrol**
1. Migratie `20261101230340_allergeen_verklaard_1.sql`. Natrekken:
   `select count(*) filter (where allergens_declared) from products` → ±67, plus de trigger in `pg_trigger`.
2. Deploy `storefront-api` (vingerafdruk GET → `ALLERGEEN-VERKLAARD-1`). Is OBER-ROEPEN-1 nog niet
   gedeployed, dan gaat het in dezelfde deploy mee: stempel en contract dekken beide.
3. Admin-publish (het vinkje). Vóór de migratie zou de kaart de kolom niet kunnen lezen, dus publiceren
   ná stap 1.
4. CI: `scripts/promo-compare/allergenDeclared.test.ts` toevoegen aan de deno-stap en
   `src/components/admin/storefront/food/ProductAllergensCard.test.tsx` aan de Vitest-stap.

**Changelog (NL)**
- Titel: Duidelijk onderscheid tussen "geen allergenen" en "nog niet ingevuld"
- Beschrijving: In de producteditor vink je nu uitdrukkelijk aan dat een gerecht geen van de 14
  allergenen bevat. Zo ziet je klant dat het nagekeken is, en zie je meteen welke gerechten nog niet
  ingevuld zijn.
