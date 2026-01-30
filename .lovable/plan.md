
# Plan: Fix Inbox Email Content & AI Suggestions

## Probleemanalyse

### Probleem 1: Email content is leeg
Alle inbound emails in de database tonen:
- `body_text: null`
- `body_html: "(Geen inhoud)"`

**Oorzaak:** De `handle-inbound-email` edge function probeert de email content op te halen via de Resend API (`GET https://api.resend.com/emails/{id}`), maar deze API call faalt of retourneert geen body. De fallback is de placeholder "(Geen inhoud)".

**Root cause mogelijkheden:**
1. Resend's email retrieve API ondersteunt mogelijk geen inbound emails (alleen verzonden emails)
2. De `email_id` in de webhook is niet hetzelfde ID dat de retrieve API verwacht
3. Resend stuurt de body gewoon niet mee in de webhook payload

### Probleem 2: AI suggestions falen met RLS error
Console toont: `new row violates row-level security policy for table "ai_assistant_config"`

**Oorzaak:** De `ai_assistant_config` tabel heeft alleen:
- SELECT policy voor tenant users
- UPDATE policy voor tenant admins
- ALL policy alleen voor service_role

Er is **geen INSERT policy** voor tenant admins. De `useAIAssistant` hook probeert automatisch een config aan te maken als die niet bestaat, maar faalt door de ontbrekende INSERT permissie.

---

## Oplossing

### Fix 1: Database - INSERT policy toevoegen voor ai_assistant_config

```sql
CREATE POLICY "Tenant admins can insert config" ON ai_assistant_config
  FOR INSERT
  TO public
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('tenant_admin', 'platform_admin')
    )
  );
```

**Alternatief (aanbevolen):** Maak een database trigger of function die automatisch een config aanmaakt wanneer een tenant wordt aangemaakt, zodat de frontend nooit hoeft te inserten.

### Fix 2: Email Parsing - Webhook data direct gebruiken

Het probleem is dat Resend's email retrieve endpoint niet werkt voor inbound emails. We moeten:

1. **Onderzoeken:** Controleren wat Resend daadwerkelijk stuurt in de webhook payload
2. **Aanpassen:** De edge function aanpassen om eerst te kijken naar `payload.text` en `payload.html` voordat de API wordt aangeroepen

**Huidige flow:**
```
Webhook → fetchEmailContent() → API call faalt → fallback "(Geen inhoud)"
```

**Nieuwe flow:**
```
Webhook → Check payload.text/html eerst → Indien leeg: probeer API → fallback
```

---

## Implementatie Details

### Database Migratie

```sql
-- 1. Add INSERT policy for ai_assistant_config
CREATE POLICY "Tenant admins can insert config" 
ON public.ai_assistant_config
FOR INSERT 
TO public
WITH CHECK (
  tenant_id IN (
    SELECT user_roles.tenant_id
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])
  )
);

-- 2. Create function to auto-initialize config for new tenants
CREATE OR REPLACE FUNCTION public.ensure_ai_assistant_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO ai_assistant_config (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Add trigger to create config when tenant is created
CREATE TRIGGER trigger_ensure_ai_assistant_config
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION ensure_ai_assistant_config();
```

### Edge Function Fix: handle-inbound-email

De prioriteit van content extractie aanpassen (regel 185-206):

```typescript
// PRIORITEIT: Webhook payload eerst, dan API call
let bodyHtml: string;
let bodyText: string | null = null;

// 1. Probeer eerst webhook payload (Resend kan body direct meesturen)
if (payload.html) {
  bodyHtml = payload.html;
  bodyText = payload.text ?? null;
  console.log("Using body from webhook payload");
} else if (payload.text) {
  bodyHtml = `<pre style="white-space: pre-wrap; font-family: inherit;">${payload.text}</pre>`;
  bodyText = payload.text;
  console.log("Using text body from webhook payload");
}
// 2. Fallback: probeer API call
else if (retrievedEmail?.html) {
  bodyHtml = retrievedEmail.html;
  bodyText = retrievedEmail.text ?? null;
  console.log("Using body from Resend API");
} else if (retrievedEmail?.text) {
  bodyHtml = `<pre style="white-space: pre-wrap; font-family: inherit;">${retrievedEmail.text}</pre>`;
  bodyText = retrievedEmail.text;
  console.log("Using text body from Resend API");
}
// 3. Fallback: geen content
else {
  bodyHtml = '<p style="color: #666; font-style: italic;">(Geen inhoud)</p>';
  bodyText = null;
  console.warn("No email body found in webhook or API");
}
```

### Extra: Logging toevoegen voor debugging

In de edge function meer logging toevoegen om te zien wat Resend exact stuurt:

```typescript
console.log("Webhook payload inspection:", {
  email_id: payload.email_id,
  has_html_in_payload: !!payload.html,
  has_text_in_payload: !!payload.text,
  html_preview: payload.html?.substring(0, 100),
  text_preview: payload.text?.substring(0, 100),
});
```

---

## Bestandswijzigingen

| Bestand | Actie |
|---------|-------|
| `supabase/migrations/xxx_fix_ai_config_rls.sql` | Nieuw - RLS policy + trigger |
| `supabase/functions/handle-inbound-email/index.ts` | Wijzigen - Email parsing prioriteit |

---

## Verificatie

1. **AI Suggestions:** Na migratie zou de AI suggestie box moeten werken zonder RLS errors
2. **Email Content:** Nieuwe inbound emails moeten body_html met echte content hebben
3. **Bestaande emails:** Kunnen niet automatisch worden hersteld - de originele content is verloren
