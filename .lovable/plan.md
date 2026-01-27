
# Plan: Meta Messages Implementatie 100% Afronden

## Huidige Status

Na analyse zijn de volgende componenten **al geïmplementeerd**:
- Database: `meta_messaging_connections` tabel + uitbreiding `customer_messages`
- Edge Functions: `meta-messaging-webhook` en `send-meta-message` bestaan
- Frontend: Inbox filters, message bubbles, reply composer met FB/IG support
- Marketing: Landing page vermeldt Facebook Messenger & Instagram DMs

## 3 Kritieke Ontbrekende Items

### 1. Config.toml Entries Ontbreken

De nieuwe edge functions staan **niet** in `supabase/config.toml`. Meta kan dus geen webhooks afleveren:

```toml
# ONTBREEKT - moet worden toegevoegd:
[functions.meta-messaging-webhook]
verify_jwt = false

[functions.send-meta-message]
verify_jwt = false
```

### 2. OAuth Scopes Ontbreken

`social-oauth-init/index.ts` vraagt **geen messaging permissions**. Huidige scopes zijn alleen voor Social Commerce (shops, catalogs), niet voor DMs:

| Huidige Scopes | Ontbrekende Scopes |
|----------------|-------------------|
| `pages_manage_posts` | `pages_messaging` |
| `instagram_basic` | `instagram_manage_messages` |
| `catalog_management` | `pages_manage_metadata` |

### 3. OAuth Callback Opslaan

De `social-oauth-callback` slaat tokens op in `social_connections`, maar voor messaging hebben we ook entries nodig in `meta_messaging_connections` met:
- `page_access_token` (per page, niet user token)
- `page_id` en `instagram_account_id`
- Webhook verify token

---

## Implementatie Plan

### Stap 1: Config.toml Bijwerken

Toevoegen aan `supabase/config.toml`:

```toml
[functions.meta-messaging-webhook]
verify_jwt = false

[functions.send-meta-message]
verify_jwt = false
```

### Stap 2: OAuth Scopes Uitbreiden

Update `social-oauth-init/index.ts` Facebook scopes array:

```typescript
scopes: [
  // Bestaande Commerce scopes
  'pages_manage_posts',
  'pages_read_engagement', 
  'instagram_basic',
  'instagram_content_publish',
  'catalog_management',
  'business_management',
  'pages_read_user_content',
  // NIEUW: Messaging scopes
  'pages_messaging',             // Facebook Messenger
  'instagram_manage_messages',   // Instagram DMs
  'pages_manage_metadata',       // Webhook subscriptions
].join(','),
```

### Stap 3: OAuth Callback Uitbreiden

Update `social-oauth-callback/index.ts` om ook:
1. Page Access Tokens op te halen (user token → page tokens)
2. Instagram Business Account IDs op te halen
3. Entries aan te maken in `meta_messaging_connections`

```typescript
// Na token exchange, haal pages op:
const pagesResponse = await fetch(
  `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokenData.access_token}`
);
const pages = await pagesResponse.json();

// Voor elke page met messaging permissions:
for (const page of pages.data) {
  await supabase.from('meta_messaging_connections').upsert({
    tenant_id,
    platform: 'facebook',
    page_id: page.id,
    page_name: page.name,
    page_access_token: page.access_token,
    is_active: true,
  });
  
  // Check voor gekoppeld Instagram account
  const igResponse = await fetch(
    `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
  );
  const igData = await igResponse.json();
  
  if (igData.instagram_business_account) {
    await supabase.from('meta_messaging_connections').upsert({
      tenant_id,
      platform: 'instagram',
      page_id: page.id,
      instagram_account_id: igData.instagram_business_account.id,
      page_access_token: page.access_token,
      is_active: true,
    });
  }
}
```

---

## Bestanden Overzicht

| Bestand | Actie |
|---------|-------|
| `supabase/config.toml` | 2 entries toevoegen |
| `supabase/functions/social-oauth-init/index.ts` | 3 scopes toevoegen |
| `supabase/functions/social-oauth-callback/index.ts` | Page token extraction + meta_messaging_connections insert |

---

## Post-Implementation: Meta App Setup

Na deze code changes moet de merchant (of jij in de Facebook Developer Console):

1. **Messenger Product toevoegen** aan de Meta App
2. **Instagram Product toevoegen** met Business Login
3. **Webhook configureren**:
   - Callback URL: `https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/meta-messaging-webhook`
   - Subscribe to: `messages`, `messaging_postbacks`
4. **App Review** indienen voor:
   - `pages_messaging` (Standard Access)
   - `instagram_manage_messages` (Advanced Access na app review)

---

## Samenvatting

| Item | Status | Actie |
|------|--------|-------|
| Database | Compleet | Geen |
| Edge Functions Code | Compleet | Geen |
| config.toml entries | ONTBREEKT | Toevoegen |
| OAuth Scopes | ONTBREEKT | 3 scopes toevoegen |
| Page Token Extraction | ONTBREEKT | Callback uitbreiden |
| Frontend | Compleet | Geen |
| Marketing | Compleet | Geen |

Na deze 3 fixes is de implementatie **100% klaar** voor productie (mits Meta App correct geconfigureerd).
