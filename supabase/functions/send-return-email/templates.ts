export type ReturnEmailEvent =
  | 'request_received'
  | 'approved'
  | 'package_received'
  | 'refund_processed';

export interface TemplateData {
  tenantName: string;
  customerName: string;
  orderNumber: string;
  rmaNumber: string;
  refundAmountFormatted: string;
  refundMethod: string;
  items: { name: string; quantity: number }[];
  supportEmail: string;
  adminLink?: string;
}

type Locale = 'nl' | 'en' | 'fr';

const subjects: Record<ReturnEmailEvent, Record<Locale, (d: TemplateData) => string>> = {
  request_received: {
    nl: (d) => `Retour-aanvraag ontvangen — RMA ${d.rmaNumber}`,
    en: (d) => `Return request received — RMA ${d.rmaNumber}`,
    fr: (d) => `Demande de retour reçue — RMA ${d.rmaNumber}`,
  },
  approved: {
    nl: () => `Je retour is goedgekeurd — instructies binnen`,
    en: () => `Your return has been approved — instructions inside`,
    fr: () => `Votre retour est approuvé — instructions ci-dessous`,
  },
  package_received: {
    nl: () => `We hebben je pakket ontvangen`,
    en: () => `We have received your package`,
    fr: () => `Nous avons bien reçu votre colis`,
  },
  refund_processed: {
    nl: (d) => `Je refund van ${d.refundAmountFormatted} is verwerkt`,
    en: (d) => `Your refund of ${d.refundAmountFormatted} has been processed`,
    fr: (d) => `Votre remboursement de ${d.refundAmountFormatted} a été traité`,
  },
};

function itemList(items: TemplateData['items']): string {
  return items.map(i => `<li>${escapeHtml(i.name)} × ${i.quantity}</li>`).join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function refundMethodLabel(method: string, locale: Locale): string {
  const labels: Record<string, Record<Locale, string>> = {
    stripe: { nl: 'je oorspronkelijke betaalmethode (Stripe)', en: 'your original payment method (Stripe)', fr: 'votre mode de paiement initial (Stripe)' },
    manual: { nl: 'bankoverschrijving', en: 'bank transfer', fr: 'virement bancaire' },
    bolcom: { nl: 'Bol.com', en: 'Bol.com', fr: 'Bol.com' },
    amazon: { nl: 'Amazon', en: 'Amazon', fr: 'Amazon' },
  };
  return labels[method]?.[locale] || method;
}

const bodies: Record<ReturnEmailEvent, Record<Locale, (d: TemplateData) => string>> = {
  request_received: {
    nl: (d) => `
      <p>Beste ${escapeHtml(d.customerName)},</p>
      <p>We hebben je retour-aanvraag ontvangen voor bestelling <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>).</p>
      <p><strong>Artikelen:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>We bekijken je aanvraag en je ontvangt bericht zodra deze is goedgekeurd.</p>
      <p>Met vriendelijke groet,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    en: (d) => `
      <p>Dear ${escapeHtml(d.customerName)},</p>
      <p>We have received your return request for order <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>).</p>
      <p><strong>Items:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>We'll review your request and notify you once it's approved.</p>
      <p>Kind regards,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    fr: (d) => `
      <p>Cher/Chère ${escapeHtml(d.customerName)},</p>
      <p>Nous avons bien reçu votre demande de retour pour la commande <strong>${escapeHtml(d.orderNumber)}</strong> (RMA : <strong>${escapeHtml(d.rmaNumber)}</strong>).</p>
      <p><strong>Articles :</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Nous examinerons votre demande et vous informerons dès qu'elle sera approuvée.</p>
      <p>Cordialement,<br/>${escapeHtml(d.tenantName)}</p>
    `,
  },
  approved: {
    nl: (d) => `
      <p>Beste ${escapeHtml(d.customerName)},</p>
      <p>Je retour voor bestelling <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>) is goedgekeurd!</p>
      <p><strong>Artikelen:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Stuur de artikelen retour. Zodra we je pakket ontvangen, sturen we je opnieuw een e-mail.</p>
      <p>Met vriendelijke groet,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    en: (d) => `
      <p>Dear ${escapeHtml(d.customerName)},</p>
      <p>Your return for order <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>) has been approved!</p>
      <p><strong>Items:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Please ship the items back to us. We'll email you again once we receive your package.</p>
      <p>Kind regards,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    fr: (d) => `
      <p>Cher/Chère ${escapeHtml(d.customerName)},</p>
      <p>Votre retour pour la commande <strong>${escapeHtml(d.orderNumber)}</strong> (RMA : <strong>${escapeHtml(d.rmaNumber)}</strong>) a été approuvé !</p>
      <p><strong>Articles :</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Veuillez nous renvoyer les articles. Nous vous enverrons un e-mail dès réception de votre colis.</p>
      <p>Cordialement,<br/>${escapeHtml(d.tenantName)}</p>
    `,
  },
  package_received: {
    nl: (d) => `
      <p>Beste ${escapeHtml(d.customerName)},</p>
      <p>We hebben je retourpakket ontvangen voor bestelling <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>).</p>
      <p><strong>Artikelen:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>We inspecteren de artikelen. Zodra alles in orde is, verwerken we je refund en ontvang je hierover bericht.</p>
      <p>Met vriendelijke groet,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    en: (d) => `
      <p>Dear ${escapeHtml(d.customerName)},</p>
      <p>We've received your return package for order <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>).</p>
      <p><strong>Items:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>We're inspecting the items. Once everything checks out, we'll process your refund and notify you.</p>
      <p>Kind regards,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    fr: (d) => `
      <p>Cher/Chère ${escapeHtml(d.customerName)},</p>
      <p>Nous avons bien reçu votre colis retour pour la commande <strong>${escapeHtml(d.orderNumber)}</strong> (RMA : <strong>${escapeHtml(d.rmaNumber)}</strong>).</p>
      <p><strong>Articles :</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Nous inspectons les articles. Une fois la vérification terminée, nous traiterons votre remboursement et vous en informerons.</p>
      <p>Cordialement,<br/>${escapeHtml(d.tenantName)}</p>
    `,
  },
  refund_processed: {
    nl: (d) => `
      <p>Beste ${escapeHtml(d.customerName)},</p>
      <p>Je refund van <strong>${d.refundAmountFormatted}</strong> voor bestelling <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>) is verwerkt via ${refundMethodLabel(d.refundMethod, 'nl')}.</p>
      <p><strong>Artikelen:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Het duurt doorgaans 3-5 werkdagen voordat het bedrag op je rekening verschijnt.</p>
      <p>Met vriendelijke groet,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    en: (d) => `
      <p>Dear ${escapeHtml(d.customerName)},</p>
      <p>Your refund of <strong>${d.refundAmountFormatted}</strong> for order <strong>${escapeHtml(d.orderNumber)}</strong> (RMA: <strong>${escapeHtml(d.rmaNumber)}</strong>) has been processed via ${refundMethodLabel(d.refundMethod, 'en')}.</p>
      <p><strong>Items:</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>It typically takes 3-5 business days for the amount to appear on your statement.</p>
      <p>Kind regards,<br/>${escapeHtml(d.tenantName)}</p>
    `,
    fr: (d) => `
      <p>Cher/Chère ${escapeHtml(d.customerName)},</p>
      <p>Votre remboursement de <strong>${d.refundAmountFormatted}</strong> pour la commande <strong>${escapeHtml(d.orderNumber)}</strong> (RMA : <strong>${escapeHtml(d.rmaNumber)}</strong>) a été traité via ${refundMethodLabel(d.refundMethod, 'fr')}.</p>
      <p><strong>Articles :</strong></p>
      <ul>${itemList(d.items)}</ul>
      <p>Le montant apparaîtra généralement sur votre relevé sous 3 à 5 jours ouvrables.</p>
      <p>Cordialement,<br/>${escapeHtml(d.tenantName)}</p>
    `,
  },
};

function wrapHtml(body: string, tenantName: string, supportEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #eee;">
          <h1 style="margin:0;font-size:20px;font-weight:600;color:#111;">${escapeHtml(tenantName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.6;color:#333;">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#999;">
            Vragen? Neem contact op via <a href="mailto:${escapeHtml(supportEmail)}" style="color:#2563eb;">${escapeHtml(supportEmail)}</a>
          </p>
          <p style="margin:0;font-size:11px;color:#ccc;">Powered by SellQo</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function getTemplate(
  event: ReturnEmailEvent,
  locale: Locale,
  data: TemplateData
): { subject: string; html: string } {
  const subject = subjects[event][locale](data);
  const body = bodies[event][locale](data);
  const html = wrapHtml(body, data.tenantName, data.supportEmail);
  return { subject, html };
}
