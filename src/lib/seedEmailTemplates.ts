import type { EmailTemplateInsert } from '@/types/marketing';

/**
 * Body-only HTML seed templates. Every template uses {{tenant_logo}},
 * {{brand_primary_color}} and {{brand_accent_color}} so the SAME content
 * automatically renders in each tenant's branding.
 *
 * Language is set by the caller (tenant's default language).
 */

const button = (label: string, href = '#') => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr><td align="center" bgcolor="{{brand_primary_color}}" style="border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;

const header = `
  <div style="text-align:center;margin-bottom:24px;">{{tenant_logo}}</div>`;

function wrap(body: string) {
  return `${header}<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${body}</div>`;
}

export function buildSeedTemplates(tenantId: string, language: string): EmailTemplateInsert[] {
  return [
    {
      tenant_id: tenantId,
      name: 'Nieuwsbrief',
      subject: 'Ons laatste nieuws voor u, {{customer_first_name}}',
      category: 'newsletter',
      language,
      is_default: false,
      html_content: wrap(`
        <h1 style="color:{{brand_primary_color}};font-size:22px;margin:0 0 12px;">Hallo {{customer_first_name}},</h1>
        <p>Welkom bij de nieuwste editie van onze nieuwsbrief. We delen graag onze recentste updates, tips en aanbiedingen met u.</p>
        <p style="border-left:3px solid {{brand_accent_color}};padding:8px 12px;background:#f9fafb;">
          <strong>Deze maand in de spotlight:</strong> ontdek wat er nieuw is bij {{company_name}}.
        </p>
        ${button('Bekijk het nieuws')}
        <p>Veel leesplezier!<br/>Het team van {{company_name}}</p>
      `),
    },
    {
      tenant_id: tenantId,
      name: 'Welkomstmail',
      subject: 'Welkom bij {{company_name}}, {{customer_first_name}} 👋',
      category: 'general',
      language,
      is_default: false,
      html_content: wrap(`
        <h1 style="color:{{brand_primary_color}};font-size:22px;margin:0 0 12px;">Fijn dat u er bent, {{customer_first_name}}!</h1>
        <p>Bedankt om lid te worden van onze community. We zijn blij u aan boord te hebben.</p>
        <p>Bij {{company_name}} zetten we ons in om u de beste ervaring te bieden. Neem gerust een kijkje in onze webshop.</p>
        ${button('Ontdek onze producten')}
        <p>Vragen? Antwoord gewoon op deze e-mail — we helpen u met plezier verder.</p>
        <p>Warme groet,<br/>Het team van {{company_name}}</p>
      `),
    },
    {
      tenant_id: tenantId,
      name: 'Promotie / korting',
      subject: '🎁 Exclusieve korting voor {{customer_first_name}}',
      category: 'promotional',
      language,
      is_default: false,
      html_content: wrap(`
        <h1 style="color:{{brand_primary_color}};font-size:24px;margin:0 0 12px;">Speciaal voor u, {{customer_first_name}}</h1>
        <p>We hebben iets moois voor u. Profiteer nu van een <strong style="color:{{brand_accent_color}};">tijdelijke korting</strong> op ons volledige assortiment.</p>
        <div style="text-align:center;padding:20px;background:#f9fafb;border:2px dashed {{brand_primary_color}};border-radius:10px;margin:20px 0;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Gebruik code</div>
          <div style="font-family:monospace;font-size:24px;font-weight:700;color:{{brand_primary_color}};letter-spacing:2px;margin-top:4px;">WELKOM10</div>
        </div>
        ${button('Shop nu')}
        <p style="font-size:13px;color:#6b7280;">Aanbieding geldig tot einde maand. Niet cumuleerbaar met andere acties.</p>
      `),
    },
    {
      tenant_id: tenantId,
      name: 'Winback',
      subject: 'We missen u, {{customer_first_name}}',
      category: 'promotional',
      language,
      is_default: false,
      html_content: wrap(`
        <h1 style="color:{{brand_primary_color}};font-size:22px;margin:0 0 12px;">Al even geleden, {{customer_first_name}}…</h1>
        <p>Het is een tijdje geleden dat we u nog gezien hebben bij {{company_name}}. We denken aan u!</p>
        <p>Om uw terugkeer te vieren geven we u <strong style="color:{{brand_accent_color}};">15% korting</strong> op uw volgende bestelling. Alleen voor u.</p>
        ${button('Kom terug en bespaar')}
        <p>Tot snel,<br/>Het team van {{company_name}}</p>
      `),
    },
  ];
}