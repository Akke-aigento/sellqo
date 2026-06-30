## Bevinding

De backend-policy fix staat actief: platform admins mogen nu `tenant_theme_settings` inserten/updaten/deleten. Voor Astra Sleep bestaat er echter nog steeds geen `tenant_theme_settings`-rij.

De huidige UI heeft daardoor nog een tweede bug: `StorefrontSettings` toont de FloatingSaveBar alleen als `themeSettings` bestaat. Bij tenants zonder theme settings row wordt de toggle lokaal wel aangepast, maar `isDirty` blijft altijd `false`, dus er verschijnt geen “Opslaan”-bar en er wordt niets gesaved.

Nieuwe tenants zullen hierdoor niet betrouwbaar direct werken, zolang er nog geen theme settings row is aangemaakt. De backend mag het nu wel, maar de UI geeft bij lege rows geen save-knop.

## Plan

1. **Fix `StorefrontSettings` dirty-state voor lege settings**
   - Voeg een `initialFormData` fallback toe voor tenants zonder `themeSettings`.
   - Laat `isDirty` vergelijken tegen die fallback, niet alleen tegen bestaande `themeSettings`.
   - Hierdoor verschijnt “Onopgeslagen wijzigingen” zodra je de custom frontend toggle aanzet, ook bij Astra Sleep/nieuwe tenants.

2. **Maak reset/cancel robuust**
   - `Annuleren` zet terug naar de huidige opgeslagen waarden als die bestaan.
   - Als er geen row bestaat, reset naar defaults: custom frontend uit, URL leeg, scripts leeg.

3. **Maak save-flow duidelijker**
   - Gebruik `mutateAsync` zodat de UI pas als opgeslagen beschouwd wordt na succesvolle backend-save.
   - Na succes wordt de query invalidated zoals nu, en de bestaande toast “Instellingen opgeslagen” blijft behouden.

4. **Geen impact op andere tenants**
   - Geen wijzigingen aan tenant data.
   - Geen wijzigingen aan tenant branding of Stream B.
   - Alleen frontend-state in `src/components/admin/storefront/StorefrontSettings.tsx`; backend policy blijft zoals ze nu is.

5. **Verificatie**
   - Check Astra Sleep: toggle aan → FloatingSaveBar verschijnt → opslaan → row wordt aangemaakt.
   - Check bestaande tenant: toggle/URL wijzigen → FloatingSaveBar blijft werken zoals voordien.
   - Optioneel DB-check dat Astra Sleep daarna `use_custom_frontend=true` bevat.