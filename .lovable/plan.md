## Migratie `send-trial-expiry-warning` naar SellQo systeemmail-layout

### Scope
Alleen de e-mail HTML/sender in `supabase/functions/send-trial-expiry-warning/index.ts`. Trial-ophaling, in-app notificatie en `trial_warning_sent_at` blijven ongewijzigd.

### Wijzigingen

**1. Import toevoegen (bovenaan)**
```ts
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";
```

**2. Tenant-branding verwijderen uit e-mail**
- `primary_color` en `logo_url` worden niet meer gebruikt in de mail-render. Ze blijven in de `select(...)` staan (raken we niet aan om query niet te wijzigen) maar worden gewoon niet gelezen voor de HTML.
- `tenantName` blijft in gebruik — puur als context in de copy ("voor <strong>${tenantName}</strong>").

**3. HTML vervangen door `renderSellqoEmail(...)`**
```ts
const billingUrl = "https://sellqo.lovable.app/admin/settings/billing";

const introHtml = `
  <p style="margin:0 0 12px;">Hoi,</p>
  <p style="margin:0 0 12px;">
    Je proefperiode van het ${planName}-plan voor <strong>${tenantName}</strong>
    eindigt op <strong>${formattedDate}</strong>.
  </p>
  <p style="margin:0;">
    Daarna gaat je account automatisch over naar het gratis plan en zijn
    sommige features tijdelijk niet meer beschikbaar tot je upgrade.
  </p>
`;

const htmlContent = renderSellqoEmail({
  preheader: `Je ${planName}-proefperiode voor ${tenantName} eindigt morgen.`,
  heading: `Je ${planName}-proefperiode eindigt morgen`,
  intro: introHtml,
  infoBox: {
    title: "✅ Je data blijft bewaard",
    subtitle: "Al je producten, bestellingen, klanten en instellingen blijven behouden. Bij een latere upgrade heb je meteen weer toegang tot alles.",
  },
  cta: { label: `Upgrade naar ${planName}`, url: billingUrl },
  ctaNote: "Je ontvangt deze e-mail omdat je een actieve proefperiode hebt.",
});
const textContent = htmlToPlainText(htmlContent);
```

**4. Resend-call aanpassen**
```ts
await resend.emails.send({
  from: "SellQo <noreply@sellqo.app>",
  reply_to: "support@sellqo.app",
  to: [tenant.owner_email],
  subject: `Je proefperiode voor ${tenantName} eindigt morgen`,
  html: htmlContent,
  text: textContent,
});
```

### Niet aanraken
- Trial-fetch query, loop, in-app notificatie-insert, `trial_warning_sent_at`-update, logging, error handling, CORS.

### Deploy
Na de edit: `supabase--deploy_edge_functions` voor `send-trial-expiry-warning`.
