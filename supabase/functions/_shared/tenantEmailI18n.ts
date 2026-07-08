// Hard-coded i18n strings for Stream B customer-facing emails.
// Adding a new locale: copy any locale block, translate values, append to
// SUPPORTED list in tenantEmail.ts and re-deploy.

import type { TenantLocale } from "./tenantEmail.ts";

type Strings = {
  order: {
    subject: string;
    heading: string;
    intro: string;
    cta: string;
    orderNumberLabel: string;
    orderDateLabel: string;
    shippingLabel: string;
    billingLabel: string;
    summary: string;
    quantity: string;
    subtotal: string;
    shipping: string;
    discount: string;
    tax: string;
    total: string;
    thanks: string;
    nextStep: string;
    supportText: string;
    closing: string;
    poweredBy: string;
  };
  invoice: {
    subject: string;
    heading: string;
    intro: string;
    cta: string;
    attached: string;
    poweredBy: string;
  };
  creditNote: {
    subject: string;
    heading: string;
    intro: string;
    attached: string;
    closing: string;
    poweredBy: string;
  };
  return: {
    subject: string;
    heading: string;
    poweredBy: string;
  };
  giftCard: {
    subject: string;
    heading: string;
    intro: string;
    cta: string;
    instructions: string;
    expires: string;
    poweredBy: string;
  };
  quote: {
    subject: string;
    heading: string;
    intro: string;
    cta: string;
    validUntil: string;
    secondaryCta: string;
    poweredBy: string;
  };
  message: {
    poweredBy: string;
    greeting: string;
    regards: string;
  };
  campaign: {
    unsubscribe: string;
    poweredBy: string;
  };
};

export const TENANT_EMAIL_STRINGS: Record<TenantLocale, Strings> = {
  nl: {
    order: {
      subject: "Bedankt voor je bestelling — {orderNumber}",
      heading: "Bedankt voor je bestelling!",
      intro: "Hi {customerName}, we hebben je bestelling ontvangen en gaan deze direct voor je klaarmaken.",
      cta: "Bekijk je bestelling",
      orderNumberLabel: "Bestelnummer",
      orderDateLabel: "Datum",
      shippingLabel: "Verzendadres",
      billingLabel: "Factuuradres",
      summary: "Besteloverzicht",
      quantity: "Aantal",
      subtotal: "Subtotaal",
      shipping: "Verzending",
      discount: "Korting",
      tax: "BTW",
      total: "Totaal",
      thanks: "Bedankt voor je bestelling! We hebben je bestelling en betaling ontvangen.",
      nextStep: "Je ontvangt automatisch een verzendbevestiging met track & trace zodra je pakket onderweg is.",
      supportText: "Vragen? Neem contact op via",
      closing: "Met vriendelijke groet",
      poweredBy: "Mogelijk gemaakt door SellQo",
    },
    invoice: {
      subject: "Factuur {invoiceNumber} van {tenantName}",
      heading: "Factuur {invoiceNumber}",
      intro: "Beste {customerName}, hierbij ontvang je de factuur voor je aankoop.",
      cta: "Bekijk factuur",
      attached: "De factuur vind je als PDF in de bijlage.",
      poweredBy: "Mogelijk gemaakt door SellQo",
      autoCollectSubject: "Factuur {invoiceNumber} — automatische incasso",
      autoCollectIntro: "Beste {customerName}, hierbij ontvang je de factuur voor je abonnement. Je hoeft niets te doen: het bedrag wordt automatisch geïncasseerd via de door jou verstrekte machtiging.",
      autoCollectProcessingNote: "Het bedrag wordt de komende dagen automatisch afgeschreven via SEPA-incasso of je opgeslagen betaalmethode. Geen actie nodig.",
      autoCollectPaidNote: "Het bedrag is automatisch geïncasseerd via SEPA of je opgeslagen betaalmethode. Deze factuur is voldaan.",
    },
    creditNote: {
      subject: "Creditnota {creditNoteNumber} - {tenantName}",
      heading: "Creditnota {creditNoteNumber}",
      intro: "Hierbij ontvang je de creditnota met betrekking tot factuur {invoiceNumber}.",
      attached: "De creditnota vind je als PDF in de bijlage.",
      closing: "Bij vragen kun je contact met ons opnemen.",
      poweredBy: "Mogelijk gemaakt door SellQo",
    },
    return: { subject: "Update retour {rmaNumber}", heading: "Update over je retour", poweredBy: "Mogelijk gemaakt door SellQo" },
    giftCard: {
      subject: "🎁 Je hebt een cadeaukaart ontvangen van {tenantName}!",
      heading: "Gefeliciteerd, {recipientName}!",
      intro: "Je hebt een cadeaukaart ontvangen van {tenantName}.",
      cta: "Verzilver nu",
      instructions: "Voer de code in bij het afrekenen om je tegoed te gebruiken.",
      expires: "Geldig tot",
      poweredBy: "Mogelijk gemaakt door SellQo",
    },
    quote: {
      subject: "Offerte {quoteNumber} van {tenantName}",
      heading: "Offerte {quoteNumber}",
      intro: "Beste {customerName}, hierbij ontvang je onze offerte.",
      cta: "Offerte accepteren",
      validUntil: "Geldig tot",
      secondaryCta: "Heb je vragen?",
      poweredBy: "Mogelijk gemaakt door SellQo",
    },
    message: { poweredBy: "Mogelijk gemaakt door SellQo", greeting: "Beste {customerName},", regards: "Met vriendelijke groet" },
    campaign: { unsubscribe: "Uitschrijven", poweredBy: "Mogelijk gemaakt door SellQo" },
  },
  en: {
    order: {
      subject: "Thank you for your order — {orderNumber}",
      heading: "Thank you for your order!",
      intro: "Hi {customerName}, we received your order and are preparing it right away.",
      cta: "View your order",
      orderNumberLabel: "Order number",
      orderDateLabel: "Date",
      shippingLabel: "Shipping address",
      billingLabel: "Billing address",
      summary: "Order summary",
      quantity: "Qty",
      subtotal: "Subtotal",
      shipping: "Shipping",
      discount: "Discount",
      tax: "VAT",
      total: "Total",
      thanks: "Thank you for your order! We received your order and payment.",
      nextStep: "You'll receive a shipping confirmation with tracking once your order is on its way.",
      supportText: "Questions? Reach us at",
      closing: "Kind regards",
      poweredBy: "Powered by SellQo",
    },
    invoice: {
      subject: "Invoice {invoiceNumber} from {tenantName}",
      heading: "Invoice {invoiceNumber}",
      intro: "Dear {customerName}, please find your invoice attached.",
      cta: "View invoice",
      attached: "Your invoice is attached as a PDF.",
      poweredBy: "Powered by SellQo",
      autoCollectSubject: "Invoice {invoiceNumber} — automatic collection",
      autoCollectIntro: "Dear {customerName}, please find your subscription invoice attached. No action is required: the amount will be collected automatically via the mandate you provided.",
      autoCollectProcessingNote: "The amount will be charged automatically over the coming days via SEPA direct debit or your saved payment method. No action needed.",
      autoCollectPaidNote: "The amount has been collected automatically via SEPA or your saved payment method. This invoice is paid in full.",
    },
    creditNote: {
      subject: "Credit note {creditNoteNumber} - {tenantName}",
      heading: "Credit note {creditNoteNumber}",
      intro: "Please find attached the credit note regarding invoice {invoiceNumber}.",
      attached: "The credit note is attached as a PDF.",
      closing: "Feel free to contact us with any questions.",
      poweredBy: "Powered by SellQo",
    },
    return: { subject: "Update on return {rmaNumber}", heading: "Return update", poweredBy: "Powered by SellQo" },
    giftCard: {
      subject: "🎁 You've received a gift card from {tenantName}!",
      heading: "Congratulations, {recipientName}!",
      intro: "You've received a gift card from {tenantName}.",
      cta: "Redeem now",
      instructions: "Enter the code at checkout to use your balance.",
      expires: "Valid until",
      poweredBy: "Powered by SellQo",
    },
    quote: {
      subject: "Quote {quoteNumber} from {tenantName}",
      heading: "Quote {quoteNumber}",
      intro: "Dear {customerName}, please find our quote below.",
      cta: "Accept quote",
      validUntil: "Valid until",
      secondaryCta: "Got questions?",
      poweredBy: "Powered by SellQo",
    },
    message: { poweredBy: "Powered by SellQo", greeting: "Dear {customerName},", regards: "Kind regards" },
    campaign: { unsubscribe: "Unsubscribe", poweredBy: "Powered by SellQo" },
  },
  fr: {
    order: {
      subject: "Merci pour votre commande — {orderNumber}",
      heading: "Merci pour votre commande !",
      intro: "Bonjour {customerName}, nous avons reçu votre commande et la préparons immédiatement.",
      cta: "Voir votre commande",
      orderNumberLabel: "Numéro de commande",
      orderDateLabel: "Date",
      shippingLabel: "Adresse de livraison",
      billingLabel: "Adresse de facturation",
      summary: "Récapitulatif",
      quantity: "Qté",
      subtotal: "Sous-total",
      shipping: "Livraison",
      discount: "Remise",
      tax: "TVA",
      total: "Total",
      thanks: "Merci pour votre commande ! Nous avons bien reçu votre commande et votre paiement.",
      nextStep: "Vous recevrez une confirmation d'expédition avec un suivi dès que votre colis sera en route.",
      supportText: "Des questions ? Contactez-nous à",
      closing: "Cordialement",
      poweredBy: "Propulsé par SellQo",
    },
    invoice: {
      subject: "Facture {invoiceNumber} de {tenantName}",
      heading: "Facture {invoiceNumber}",
      intro: "Cher/Chère {customerName}, veuillez trouver votre facture en pièce jointe.",
      cta: "Voir la facture",
      attached: "La facture est jointe en PDF.",
      poweredBy: "Propulsé par SellQo",
      autoCollectSubject: "Facture {invoiceNumber} — prélèvement automatique",
      autoCollectIntro: "Cher/Chère {customerName}, veuillez trouver ci-joint la facture de votre abonnement. Aucune action requise : le montant sera prélevé automatiquement via le mandat que vous avez fourni.",
      autoCollectProcessingNote: "Le montant sera prélevé automatiquement dans les prochains jours par SEPA ou via votre moyen de paiement enregistré. Aucune action nécessaire.",
      autoCollectPaidNote: "Le montant a été prélevé automatiquement par SEPA ou via votre moyen de paiement enregistré. Cette facture est réglée.",
    },
    creditNote: {
      subject: "Note de crédit {creditNoteNumber} - {tenantName}",
      heading: "Note de crédit {creditNoteNumber}",
      intro: "Veuillez trouver ci-jointe la note de crédit relative à la facture {invoiceNumber}.",
      attached: "La note de crédit est jointe en PDF.",
      closing: "N'hésitez pas à nous contacter en cas de question.",
      poweredBy: "Propulsé par SellQo",
    },
    return: { subject: "Mise à jour du retour {rmaNumber}", heading: "Mise à jour de votre retour", poweredBy: "Propulsé par SellQo" },
    giftCard: {
      subject: "🎁 Vous avez reçu une carte-cadeau de {tenantName} !",
      heading: "Félicitations, {recipientName} !",
      intro: "Vous avez reçu une carte-cadeau de {tenantName}.",
      cta: "Utiliser maintenant",
      instructions: "Entrez le code à la caisse pour utiliser votre solde.",
      expires: "Valable jusqu'au",
      poweredBy: "Propulsé par SellQo",
    },
    quote: {
      subject: "Devis {quoteNumber} de {tenantName}",
      heading: "Devis {quoteNumber}",
      intro: "Cher/Chère {customerName}, veuillez trouver notre devis ci-dessous.",
      cta: "Accepter le devis",
      validUntil: "Valable jusqu'au",
      secondaryCta: "Des questions ?",
      poweredBy: "Propulsé par SellQo",
    },
    message: { poweredBy: "Propulsé par SellQo", greeting: "Cher/Chère {customerName},", regards: "Cordialement" },
    campaign: { unsubscribe: "Se désabonner", poweredBy: "Propulsé par SellQo" },
  },
  de: {
    order: {
      subject: "Vielen Dank für Ihre Bestellung — {orderNumber}",
      heading: "Vielen Dank für Ihre Bestellung!",
      intro: "Hallo {customerName}, wir haben Ihre Bestellung erhalten und bereiten sie sofort vor.",
      cta: "Bestellung ansehen",
      orderNumberLabel: "Bestellnummer",
      orderDateLabel: "Datum",
      shippingLabel: "Lieferadresse",
      billingLabel: "Rechnungsadresse",
      summary: "Bestellübersicht",
      quantity: "Anz.",
      subtotal: "Zwischensumme",
      shipping: "Versand",
      discount: "Rabatt",
      tax: "MwSt.",
      total: "Gesamt",
      thanks: "Vielen Dank für Ihre Bestellung! Wir haben Ihre Bestellung und Zahlung erhalten.",
      nextStep: "Sie erhalten eine Versandbestätigung mit Sendungsverfolgung, sobald Ihr Paket unterwegs ist.",
      supportText: "Fragen? Kontaktieren Sie uns unter",
      closing: "Mit freundlichen Grüßen",
      poweredBy: "Bereitgestellt von SellQo",
    },
    invoice: {
      subject: "Rechnung {invoiceNumber} von {tenantName}",
      heading: "Rechnung {invoiceNumber}",
      intro: "Sehr geehrte/r {customerName}, anbei erhalten Sie Ihre Rechnung.",
      cta: "Rechnung ansehen",
      attached: "Die Rechnung finden Sie als PDF im Anhang.",
      poweredBy: "Bereitgestellt von SellQo",
      autoCollectSubject: "Rechnung {invoiceNumber} — automatischer Einzug",
      autoCollectIntro: "Sehr geehrte/r {customerName}, anbei erhalten Sie die Rechnung zu Ihrem Abonnement. Sie müssen nichts unternehmen: Der Betrag wird automatisch über das von Ihnen erteilte Mandat eingezogen.",
      autoCollectProcessingNote: "Der Betrag wird in den nächsten Tagen automatisch per SEPA-Lastschrift oder über Ihre gespeicherte Zahlungsmethode eingezogen. Es ist keine Aktion erforderlich.",
      autoCollectPaidNote: "Der Betrag wurde automatisch per SEPA oder über Ihre gespeicherte Zahlungsmethode eingezogen. Diese Rechnung ist beglichen.",
    },
    creditNote: {
      subject: "Gutschrift {creditNoteNumber} - {tenantName}",
      heading: "Gutschrift {creditNoteNumber}",
      intro: "Anbei erhalten Sie die Gutschrift zur Rechnung {invoiceNumber}.",
      attached: "Die Gutschrift finden Sie als PDF im Anhang.",
      closing: "Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
      poweredBy: "Bereitgestellt von SellQo",
    },
    return: { subject: "Update zu Rücksendung {rmaNumber}", heading: "Update zu Ihrer Rücksendung", poweredBy: "Bereitgestellt von SellQo" },
    giftCard: {
      subject: "🎁 Sie haben eine Geschenkkarte von {tenantName} erhalten!",
      heading: "Herzlichen Glückwunsch, {recipientName}!",
      intro: "Sie haben eine Geschenkkarte von {tenantName} erhalten.",
      cta: "Jetzt einlösen",
      instructions: "Geben Sie den Code an der Kasse ein, um Ihr Guthaben zu nutzen.",
      expires: "Gültig bis",
      poweredBy: "Bereitgestellt von SellQo",
    },
    quote: {
      subject: "Angebot {quoteNumber} von {tenantName}",
      heading: "Angebot {quoteNumber}",
      intro: "Sehr geehrte/r {customerName}, anbei unser Angebot.",
      cta: "Angebot annehmen",
      validUntil: "Gültig bis",
      secondaryCta: "Haben Sie Fragen?",
      poweredBy: "Bereitgestellt von SellQo",
    },
    message: { poweredBy: "Bereitgestellt von SellQo", greeting: "Sehr geehrte/r {customerName},", regards: "Mit freundlichen Grüßen" },
    campaign: { unsubscribe: "Abmelden", poweredBy: "Bereitgestellt von SellQo" },
  },
};

function getByPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

/** Lookup with `{var}` interpolation. */
export function t(locale: string, path: string, vars?: Record<string, string | number>): string {
  const loc = (TENANT_EMAIL_STRINGS as any)[locale] ? (locale as TenantLocale) : "en";
  const raw = getByPath(TENANT_EMAIL_STRINGS[loc], path);
  let s = typeof raw === "string" ? raw : path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}