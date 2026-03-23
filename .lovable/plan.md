

## Fix Cloudflare Auto-Connect + Documentatiepagina

### Fix 1: Cloudflare DNS auto-connect logica

**Bestand:** `supabase/functions/cloudflare-api-connect/index.ts`

Het huidige probleem: de edge function haalt alleen records op die exact matchen op `name={cleanDomain}` (regel 141), waardoor `www.` en `_sellqo.` records niet gevonden worden. Ook worden conflicterende CNAME records niet afgehandeld.

**Wijzigingen:**
1. Alle DNS records voor de zone ophalen (zonder name-filter) via `GET /zones/{zone_id}/dns_records?per_page=500`
2. Voor elk vereist record (@ A, www A, _sellqo TXT):
   - Als een record met hetzelfde name+type bestaat → PATCH (update)
   - Als een CNAME voor `www.{domain}` bestaat → DELETE eerst, dan A record aanmaken
   - Als een TXT record voor `_sellqo.{domain}` bestaat met verkeerde waarde → DELETE + recreate
3. Per-record feedback in de response (welke records created/updated/deleted)

### Fix 2: Documentatiepagina in Instellingen

**Nieuw bestand:** `src/components/admin/settings/DocumentationSettings.tsx`
- Sectie "Cloudflare koppelen" met 7 stappen (exact zoals beschreven in de vraag)
- Clean styling, consistent met admin UI (Card, numbered steps, code-achtige highlights)

**Bestand:** `src/pages/admin/Settings.tsx`
- Nieuwe sectie `{ id: 'documentation', title: 'Documentatie', icon: BookOpen, component: DocumentationSettings }` toevoegen aan de `channels` group (of nieuwe group)

**Bestand:** `src/components/admin/settings/DomainVerificationPanel.tsx`
- Kleine "Hoe werkt dit? →" link toevoegen naast de "Cloudflare automatisch koppelen" header, die linkt naar `/admin/settings?section=documentation`

### Bestanden
- `supabase/functions/cloudflare-api-connect/index.ts` — fix DNS record handling
- `src/components/admin/settings/DocumentationSettings.tsx` — nieuw
- `src/pages/admin/Settings.tsx` — documentatie sectie toevoegen
- `src/components/admin/settings/DomainVerificationPanel.tsx` — "Hoe werkt dit?" link

