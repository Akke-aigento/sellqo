

## Fix: cleanup-connected-accounts 401 error

### Probleem
De edge function `cleanup-connected-accounts` heeft geen `verify_jwt = false` in `supabase/config.toml`. De Supabase gateway weigert het request daarom met een 401, nog voordat de functie zelf wordt uitgevoerd. Alle andere edge functions in het project hebben dit wél geconfigureerd.

### Oplossing
Voeg een config block toe aan `supabase/config.toml`:

```toml
[functions.cleanup-connected-accounts]
verify_jwt = false
```

De functie valideert authenticatie en de `platform_admin` rol al in de code zelf, dus dit is veilig.

### Na deployment
Zodra de function opnieuw is gedeployed, roep ik hem aan om alle 5 connected Stripe accounts te verwijderen:
- Demo Bakkerij (`acct_1Sq805Rwtif7i2ny`)
- Loveke (`acct_1T4KKmRoQPtwaESn`)
- SellQo (`acct_1SuIYTRziCKgbo3A`)
- VanXcel (`acct_1T3af42OokKpgnyV`)
- Mancini Milano (`acct_1TI7bxRvfrLqgh95`)

Daarna worden de database-velden gereset zodat tenants opnieuw kunnen onboarden.

