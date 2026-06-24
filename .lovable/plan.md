
## Diagnose

Sander selecteert foto's op zijn Android-toestel, maar ze "komen niet tevoorschijn". Geen zichtbare foutmelding. Op iPhone werkt het wel. De oorzaak ligt vrijwel zeker in `src/hooks/useImageUpload.ts` gecombineerd met de `<input accept="...">` in `src/pages/admin/ProductForm.tsx` (regel 1547):

```ts
// useImageUpload.ts
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!allowedTypes.includes(file.type)) { toast... return null; }
if (file.size > 5 * 1024 * 1024) { toast... return null; }
```

```tsx
// ProductForm.tsx
<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple ... />
```

Drie Android-specifieke faalmodi, alle silent voor de gebruiker:

1. **MIME-type leeg of onverwacht** — Android's `content://` provider levert vaak `file.type === ''` (vooral via Samsung Gallery, Google Foto's, of "Recente bestanden"). Strikte `includes()` faalt dan en de file wordt geweigerd. iOS levert altijd een proper MIME.
2. **HEIC/HEIF van moderne Android-camera's** — Samsung S-serie, Pixel en OnePlus schieten standaard in HEIC (high-efficiency). `file.type === 'image/heic'` matcht niet en wordt geweigerd. Ook de `accept` filter blokkeert deze al in sommige Android-pickers, waardoor de geselecteerde foto's grijs blijven of helemaal niet doorkomen.
3. **5MB size-limit** — moderne telefoonfoto's (Samsung 50/200MP, Pixel) zitten standaard tussen 5-15MB per foto. Iedere foto > 5MB wordt geweigerd.

In alle drie de gevallen returnt `uploadImage` `null`, valt het `if (url)` in `handleImageUpload` over, en de foto verschijnt niet in de form-state. De toast verschijnt wel maar:
- bij meerdere foto's krijg je een stack van identieke toasts die elkaar overlappen
- toast-duration (default ~4s) is kort op een klein scherm met onscreen keyboard
- "Bestand te groot" of "Ongeldig bestandstype" wordt door Sander gelezen als generiek en niet aan de upload-poging gekoppeld

Daarom voelt het voor hem als "er gebeurt niks".

## Fix-aanpak (alleen UI/upload-laag, geen RLS/storage/business-logica)

### 1. `src/hooks/useImageUpload.ts` — tolerantere validatie

- Vervang strikte MIME-lijst door een prefix-check: accepteer alles waarvan `file.type.startsWith('image/')` OF `file.type === ''` (Android leeg-MIME) mits de filenaam-extensie een bekende image-extensie is (jpg/jpeg/png/webp/gif/heic/heif/avif/bmp). Sluit alleen expliciet niet-image MIME's uit (video/*, application/*).
- Verhoog `maxSize` naar 20 MB (komt overeen met de chat-upload limiet die elders in het project geldt). Telefoonfoto's blijven daar nagenoeg altijd onder; echte 50 MB RAW's blokkeer je nog steeds.
- Toast-fouten krijgen `duration: 8000` en bevatten de bestandsnaam, zodat een gebruiker met meerdere fotos ziet welke faalde en waarom.
- Voeg een laatste fallback toe: bij `file.type === ''` zet de upload `contentType` expliciet op basis van de extensie (anders krijgt Supabase Storage `application/octet-stream` en kan de browser de image later niet als image tonen). Voorbeeld: `.heic` → `image/heic`, `.jpg` → `image/jpeg`.

### 2. `src/pages/admin/ProductForm.tsx` — input accept relaxen + per-file feedback

- Wijzig `accept="image/jpeg,image/png,image/webp,image/gif"` naar `accept="image/*"`. Dit is de aanbevolen Android-praktijk: het laat de systeem-picker alle foto-bronnen tonen (camera, gallery, Google Foto's, Drive) en filtert niet ten onrechte HEIC/HEIF weg.
- In `handleImageUpload`: na de loop, als er files waren maar `currentImages.length` niet is gegroeid, toon één samenvattende toast ("Geen van de geselecteerde foto's kon worden geüpload") zodat de gebruiker weet dát er iets fout ging — ook als de per-file toasts hem ontgaan.
- Voeg een `capture` hint weg (we voegen 'm niet toe) zodat Android de bestaande "Camera of Galerij?"-dialog blijft tonen.

### 3. HEIC-conversie — uit scope voor deze batch

Echte HEIC → JPEG conversie in de browser vereist een library (heic2any of vergelijkbaar, ~500 KB) en is een aparte beslissing. Voor nu: HEIC bestanden worden upload-baar gemaakt (punt 1+2) en de browser/Supabase serveert ze met `image/heic` content-type. Chrome op Android rendert HEIC native; Safari ook. Render in admin-grid werkt dan via `<img src>`. Als Sander hierna nog rendering-problemen op de webshop ervaart, openen we een tweede ticket voor client-side conversie.

### 4. Verificatie

- Mobile viewport in DevTools (iPhone XR + Pixel 7 user agent) → upload .jpg > 5 MB → moet slagen.
- Simuleer leeg `file.type` via een unit-achtig handmatige check in de console (`new File([], 'x.jpg', { type: '' })`) → mag niet geweigerd worden.
- Bestaande Mancini-tenant: upload een normale productfoto, controleer dat featured_image gedrag (eerste foto = hoofd) onveranderd is.
- Geen regressie op desktop-flow: upload meerdere foto's tegelijk, controleer dat ze allemaal verschijnen.

### Bestanden die wijzigen

- `src/hooks/useImageUpload.ts` — validatie + contentType-fallback + langere toast-duration
- `src/pages/admin/ProductForm.tsx` — `accept="image/*"` + samenvattende fallback-toast in `handleImageUpload`

### Niet aangeraakt

- RLS / storage bucket policies (`product-images` blijft zoals het is)
- `useProducts`, `ProductPhotosManager`, `ProductVariantsTab`, image-rendering logica
- Andere consumers van `useImageUpload` (logos, AI-images, marketing-assets) — die profiteren wel mee van de relaxe validatie, wat een gewenste neveneffect is
