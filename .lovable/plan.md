

## Migratie-compatibele Registratie + E-mailbevestiging

### Huidige situatie

1. **`password_hash` is `NOT NULL`** — gemigreerde klanten kunnen niet eens in `storefront_customers` staan zonder wachtwoord
2. **Register action (regel 131-132)** gooit altijd "email already exists" als het e-mailadres al bestaat, ongeacht of er een wachtwoord is
3. **Geen e-mailverificatie** — registratie geeft direct een token, geen bevestigingsmail

### Wat we bouwen

**1. Database migratie**

| Wijziging | Reden |
|---|---|
| `password_hash` nullable maken | Gemigreerde klanten kunnen bestaan zonder wachtwoord |
| `email_verified BOOLEAN DEFAULT false` toevoegen | E-mailbevestiging tracking |
| `email_verification_token TEXT` toevoegen | Token voor verificatielink |
| `email_verification_expires_at TIMESTAMPTZ` toevoegen | Verloopdatum token |

**2. Register action aanpassen** (`storefront-customer-api/index.ts`)

Huidige flow (regel 126-167):
```
Email bestaat? → Error
Anders → Insert + token
```

Nieuwe flow:
```text
Email bestaat?
  → Heeft password_hash? → Error "Account bestaat al, log in"
  → Geen password_hash (gemigreerd)?
      → Claim account: set password_hash, update profiel
      → Stuur verificatiemail
      → Return { message: "Verificatiemail verstuurd" } (GEEN token)

Email bestaat niet?
  → Insert nieuwe klant
  → Stuur verificatiemail
  → Return { message: "Verificatiemail verstuurd" } (GEEN token)
```

**3. E-mailverificatie flow**

- Nieuwe action `verify_email`: ontvangt token, valideert, zet `email_verified = true`, geeft JWT token terug
- Verificatielink wijst naar storefront pagina `/verify-email?token=...&email=...`
- Verificatiemail via Resend (zelfde patroon als password reset)

**4. Login aanpassen**

- Check `email_verified` — als `false`, return error "Bevestig eerst je e-mailadres"
- Nieuwe action `resend_verification`: stuurt verificatiemail opnieuw

**5. Storefront UI**

- `StorefrontVerifyEmail.tsx` — pagina die token valideert en doorverwijst naar login
- Registratieformulier toont na submit: "Check je e-mail om je account te bevestigen"
- Login error bij onbevestigd account toont link om verificatiemail opnieuw te versturen

### Bestanden

| Bestand | Wijziging |
|---|---|
| Nieuwe migratie | `password_hash` nullable, verificatie-kolommen |
| `storefront-customer-api/index.ts` | Register claim-flow, verify_email action, resend_verification, login check |
| `src/pages/shop/StorefrontVerifyEmail.tsx` | Verificatiepagina |
| `src/pages/shop/StorefrontRegister.tsx` of login component | Success-state na registratie |
| Routes (`App.tsx` of shop router) | `/shop/:tenantSlug/verify-email` route |

### Verwacht gedrag

| Scenario | Resultaat |
|---|---|
| Nieuw e-mailadres | Insert → verificatiemail → bevestigen → login |
| Gemigreerd e-mailadres (geen wachtwoord) | Claim → wachtwoord gezet → verificatiemail → bevestigen → login + oude orders zichtbaar |
| Al geregistreerd (heeft wachtwoord + verified) | Error "Account bestaat al, log in" |
| Login zonder verificatie | Error "Bevestig eerst je e-mailadres" + optie opnieuw versturen |

