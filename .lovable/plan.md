

# Fix: Facebook/Instagram Messenger verbinding - 400 error

## Oorzaak

Er zijn twee problemen:

### 1. Geen Meta credentials geconfigureerd
De `tenant_oauth_credentials` tabel is leeg. De `social-oauth-init` edge function vereist dat je eerst je Meta App ID en App Secret hebt ingevoerd via **Instellingen -> API Credentials** (het `SocialCredentialsForm`). Zonder deze credentials kan de OAuth-flow niet starten.

### 2. Foutmelding wordt niet correct getoond
Wanneer de edge function een 400 returnt met een duidelijke melding ("OAuth niet geconfigureerd, ga naar Instellingen..."), vangt de code dit af als een generieke error via `if (error) throw error`. De gebruiksvriendelijke melding met `missingConfig` wordt daardoor nooit bereikt.

## Oplossing

### Bestand: `src/components/admin/marketplace/MessagingChannelList.tsx`

De error handling in `handleConnect` aanpassen zodat een 400-response correct wordt geparsed:

**Huidige code (probleem):**
```typescript
const { data, error } = await supabase.functions.invoke('social-oauth-init', { ... });
if (error) throw error;  // <-- Gooit fout voordat missingConfig wordt gecheckt
```

**Nieuwe code (fix):**
```typescript
const { data, error } = await supabase.functions.invoke('social-oauth-init', { ... });

if (error) {
  // Bij een non-2xx response bevat data vaak de JSON body met details
  const errorData = data || {};
  if (errorData?.missingConfig) {
    toast.error(
      'Meta App credentials niet geconfigureerd. Ga naar Instellingen → API Credentials om je Meta App ID en Secret in te voeren.',
      { duration: 8000 }
    );
    return;
  }
  throw error;
}
```

Dit zorgt ervoor dat:
- Bij een ontbrekende configuratie een duidelijke melding verschijnt die de gebruiker naar de juiste plek stuurt
- Andere fouten nog steeds als generieke fout worden getoond

### Geen andere wijzigingen nodig

- De `social-oauth-init` edge function werkt correct -- hij stuurt al de juiste 400-response met `missingConfig: true`
- De `SocialCredentialsForm` in Instellingen werkt al voor het invoeren van Meta credentials
- Zodra de credentials zijn ingevoerd, zal de OAuth-flow correct starten

---

**Belangrijk:** Na deze fix moet je eerst je Meta App ID en App Secret invoeren via Instellingen voordat Facebook Messenger / Instagram DM's verbonden kunnen worden.

