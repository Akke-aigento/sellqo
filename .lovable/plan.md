
# Plan: Fix E-mail Body Ophalen & Notificatie Geluid

## Probleem 1: E-mail body is leeg

### Root Cause Analyse
De Resend logs tonen:
```
{
  "name": "restricted_api_key",
  "message": "This API key is restricted to only send emails",
  "statusCode": 401
}
```

Dit is eigenlijk een misleidende foutmelding. Het echte probleem is:

1. **Webhook bevat geen body** - Resend stuurt bewust geen email body in webhooks (zie hun documentatie: "Webhooks do not include the email body, headers, or attachments, only their metadata")
2. **Verkeerde API endpoint** - De code probeert `GET /emails/{id}` wat alleen werkt voor **verzonden** emails
3. **Juiste endpoint** - Voor inbound emails moet je `GET /emails/receiving/{id}` gebruiken

### Oplossing
Aanpassen van de `fetchEmailContent` functie in de edge function om de correcte Resend **Receiving API** te gebruiken:

```typescript
// FOUT (huidige code - voor verzonden emails)
const response = await fetch(`https://api.resend.com/emails/${emailId}`, ...);

// CORRECT (voor ontvangen emails)
const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, ...);
```

De Receiving API retourneert:
```json
{
  "id": "737944da-...",
  "from": "sender@example.com",
  "to": ["recipient@sellqo.app"],
  "subject": "...",
  "html": "<html>...",  // ✅ De body!
  "text": "...",         // ✅ Plain text versie
  "raw": {
    "download_url": "..."  // Optioneel: voor raw email parsing
  }
}
```

---

## Probleem 2: Wit scherm bij eerste keer openen

### Root Cause
De `MessageBubble` component crashed waarschijnlijk wanneer `body_html` de placeholder tekst bevat of `body_text` null is. Het `getBodyContent()` functie strippt HTML tags, wat bij de fallback placeholder een lege string kan opleveren.

### Oplossing
1. Betere fallback handling in `MessageBubble.tsx`
2. Toon een duidelijke "geen inhoud" melding als body leeg is

---

## Probleem 3: Geen notificatie geluid bij inkomend bericht

### Huidige Situatie
- Rode bolletje verschijnt (via `useUnreadMessagesCount` hook)
- Toast notificatie wordt getoond (via `useInbox` realtime subscription)
- Geen audio/geluid functionaliteit geïmplementeerd

### Oplossing
1. Maak een `useNotificationSound` hook
2. Voeg browser notificatie permissie toe (optioneel)
3. Speel geluid af bij nieuwe berichten (als gebruiker dat wil)
4. Voeg instelling toe in tenant settings

---

## Technische Implementatie

### 1. Edge Function Fix (handle-inbound-email/index.ts)

Wijzig de `fetchEmailContent` functie:

```typescript
async function fetchEmailContent(
  emailId: string, 
  apiKey: string
): Promise<ResendRetrievedEmail | null> {
  try {
    // CRITICAL: Use /receiving/ endpoint for inbound emails!
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend Receiving API error (${response.status}):`, 
        errorText.substring(0, 300));
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch inbound email:', error);
    return null;
  }
}
```

### 2. MessageBubble Fallback (MessageBubble.tsx)

Verbeter de body content weergave:

```typescript
const getBodyContent = () => {
  // Prefer plain text
  if (message.body_text && message.body_text.trim()) {
    return message.body_text;
  }
  
  // Strip HTML but handle empty result
  if (message.body_html) {
    const stripped = message.body_html.replace(/<[^>]*>/g, '').trim();
    if (stripped && !stripped.includes('Geen inhoud')) {
      return stripped;
    }
  }
  
  // Fallback
  return '(Geen inhoud beschikbaar)';
};
```

### 3. Notificatie Geluid (nieuw bestand + hook update)

Maak een geluidssysteem:

```typescript
// src/hooks/useNotificationSound.ts
const NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('notification_sound') !== 'disabled';
  });

  const playSound = useCallback(() => {
    if (!enabled) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.5;
    }
    
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Browser blocked autoplay - ignore
    });
  }, [enabled]);

  return { playSound, enabled, setEnabled };
}
```

Integreer in `useInbox.ts`:

```typescript
// In realtime subscription callback
if ((payload.new as InboxMessage).direction === 'inbound') {
  playSound();  // Speel geluid
  toast({...});
}
```

---

## Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `supabase/functions/handle-inbound-email/index.ts` | Wijzigen | Fix API endpoint naar `/emails/receiving/` |
| `src/components/admin/inbox/MessageBubble.tsx` | Wijzigen | Betere fallback voor lege body |
| `src/hooks/useNotificationSound.ts` | Nieuw | Audio notificatie hook |
| `src/hooks/useInbox.ts` | Wijzigen | Geluid afspelen bij nieuw bericht |
| `public/sounds/notification.mp3` | Nieuw | Notificatie geluidje (kort, subtiel) |

---

## Verificatie

1. **Email body**: Stuur test email → body moet nu correct worden opgehaald
2. **UI crash**: Open conversatie → geen wit scherm meer
3. **Geluid**: Ontvang nieuw bericht → geluid hoorbaar (indien enabled)
