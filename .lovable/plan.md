
Diagnose (grondig nagekeken)

- Do I know what the issue is? Ja.
- De foutlus komt niet door de 3-record DNS logica zelf, maar door een token-bron mismatch:
  - `verify-domain` valideert multi-domain tegen `tenant_domains.verification_token` (via `domain_id`).
  - `cloudflare-api-connect` gebruikt nu `tenants.domain_verification_token`.
  - Resultaat: `_sellqo` wordt naar de “tenant token” gezet, terwijl verificatie verwacht dat hij matcht met de “domain token”.
- Bewijs uit logs/data:
  - `verify-domain` logs tonen telkens `a_record_valid: true`, `txt_record_valid: false`, `current_txt_record: sellqo-verify=c998...`
  - `tenant_domains` voor `vanxcel.be` heeft `verification_token=f6f3...`
  - `cloudflare-api-connect` logs tonen “TXT skipped” op de oude waarde, dus hij blijft fout voor de domain-verificatie.
- Extra symptoom: UI toont soms “SSL actief” terwijl `dns_verified` nog false is, wat verwarrend is.

Implementatieplan

1) Fix request-contract tussen UI en backend
- Bestand: `src/hooks/useDomainVerificationMulti.ts`
- `connectWithApiToken` stuurt ook `domain_id: domain.id` mee naar `cloudflare-api-connect`.
- Zo werkt auto-connect altijd op het juiste domeinrecord.

2) Fix token-resolutie in `cloudflare-api-connect` (kernfix)
- Bestand: `supabase/functions/cloudflare-api-connect/index.ts`
- Resolutievolgorde:
  1. Als `domain_id` meegegeven is: haal `tenant_domains` record op (`id + tenant_id`) en gebruik exact die `verification_token`.
  2. Zo niet: probeer `tenant_domains` lookup op (`tenant_id + cleanDomain`).
  3. Enkel als fallback: legacy `tenants.domain_verification_token`.
- `_sellqo` TXT wordt altijd opgebouwd met de resolvde token van het target domain context.
- 3-record contract blijft strikt identiek (alleen `@ A`, `www A`, `_sellqo TXT`).

3) Consistente updates na succesvolle sync
- Bestand: `supabase/functions/cloudflare-api-connect/index.ts`
- Bij succes:
  - update het juiste `tenant_domains` record (minstens token sync als die ontbrak, en optioneel state-velden die in deze flow horen).
  - legacy `tenants` alleen bij fallback/legacy pad om backward compatibility te behouden.
- Geen wijzigingen aan andere DNS-record types/namen.

4) Verificatie-feedback verbeteren (zodat errors niet “leeg” lijken)
- Bestand: `supabase/functions/verify-domain/index.ts`
- Voeg expliciete fouttak toe voor “TXT bestaat maar waarde mismatcht” met duidelijke `error` + `error_details` (verwacht vs gevonden).
- Zo ziet gebruiker meteen dat enkel `_sellqo` token fout staat.

5) UI-statuslogica rechttrekken
- Bestand: `src/components/admin/settings/DomainVerificationPanel.tsx`
- Statusbadge/progress eerst laten afhangen van `dns_verified`; pas “SSL actief/live” tonen wanneer DNS ook verified is.
- Vermijdt de huidige “groen + toch error” verwarring.

6) Validatieplan (na implementatie)
- Test 1: domein met mismatch token → auto-connect moet `_sellqo` vervangen naar domain-token en verify moet slagen.
- Test 2: bestaande SPF/DMARC/Google/MS TXT records blijven onaangeraakt.
- Test 3: `www` CNAME scenario blijft correct (delete CNAME → create A).
- Test 4: UI toont geen contradictie meer (geen “SSL actief” terwijl DNS nog false).
- Test 5: edge logs moeten eindigen op `success: true` + verify-domain `txt_record_valid: true`.
