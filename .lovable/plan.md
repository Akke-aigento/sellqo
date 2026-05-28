## Migratie `create-notification` naar SellQo systeemmail-layout

### Scope
Alleen email-HTML + sender in `supabase/functions/create-notification/index.ts`. In-app insert, settings-check, recipients, `email_sent_at`-update en catch blijven exact zoals ze zijn.

### Wijzigingen

**1. Import bovenaan**
```ts
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";
```

**2. Branding-velden niet meer gebruiken in mail**
- `primary_color` en `logo_url` worden niet meer ingelezen voor de HTML (de `select(...)` blijft staan om de query niet te wijzigen, maar de variabelen worden verwijderd).
- `tenantName` blijft behouden voor copy + onderwerp.

**3. `fullActionUrl`-berekening blijft ongewijzigd.**

**4. Vervang inline `htmlContent` door `renderSellqoEmail({...})`**
```ts
const priorityBanner =
  priority === 'urgent'
    ? `<div style="background-color:#fee2e2;color:#dc2626;padding:12px 16px;border-radius:6px;margin:0 0 16px;font-weight:600;">⚠️ Urgente melding — directe aandacht vereist</div>`
    : priority === 'high'
      ? `<div style="background-color:#ffedd5;color:#ea580c;padding:12px 16px;border-radius:6px;margin:0 0 16px;font-weight:600;">Hoge prioriteit</div>`
      : '';

const introHtml = `
  ${priorityBanner}
  <p style="margin:0 0 12px;font-size:13px;color:#5b6b7d;">Melding voor <strong>${tenantName}</strong></p>
  <p style="margin:0;">${notification.message}</p>
`;

const htmlContent = renderSellqoEmail({
  preheader: `${notification.title} — ${tenantName}`,
  heading: notification.title,
  intro: introHtml,
  cta: fullActionUrl ? { label: 'Bekijk details', url: fullActionUrl } : undefined,
  footerNote: `Je ontvangt deze e-mail omdat e-mailnotificaties voor ${notification.category} aanstaan.`,
});
const textContent = htmlToPlainText(htmlContent);
```

**5. Onderwerp**
```ts
const emailSubject = `${prioritySubjects[priority]}${notification.title} — ${tenantName}`;
```

**6. Resend-call**
```ts
await resend.emails.send({
  from: "SellQo <noreply@sellqo.app>",
  reply_to: "support@sellqo.app",
  to: recipients,
  subject: emailSubject,
  html: htmlContent,
  text: textContent,
});
```

### Niet aanraken
In-app `notifications`-insert, `tenant_notification_settings`-check, `recipients`-logica, `email_sent_at`-update, try/catch, auth, CORS, response.

### Deploy
`supabase--deploy_edge_functions` voor `create-notification` na de edit.
