

## SellQo Legal Pages Fixen

### Twee problemen gevonden

**Probleem 1: Alle pagina's zijn niet gepubliceerd**
De 6 legal pages bestaan in de database maar hebben allemaal `is_published = false`. De publieke hook filtert op `is_published = true`, dus ze tonen "Pagina niet gevonden".

**Probleem 2: Slug-extractie werkt niet**
De routes zijn statisch (`/terms`, `/privacy`, etc.) maar het component probeert `useParams<{ slug }>` te gebruiken — dat retourneert altijd `undefined` omdat er geen `:slug` parameter in de route zit. De query draait dus nooit.

### Oplossing

| Actie | Bestand/Locatie | Wat |
|-------|----------------|-----|
| Database | Migration | `UPDATE sellqo_legal_pages SET is_published = true, last_published_at = now()` voor alle pagina's |
| Wijzig | `src/pages/SellqoLegal.tsx` | Vervang `useParams()` door `useLocation()` — haal slug uit pathname (`/terms` → `terms`) |

Twee kleine wijzigingen, geen nieuwe bestanden nodig.

