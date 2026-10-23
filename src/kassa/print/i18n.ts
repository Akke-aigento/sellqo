// PRINT-1 — woordenboek voor tickets (PRT-08).
//
// Waarom NIET via react-i18next / src/i18n zoals de rest van SellQo:
// - Een ticket is een fiscaal document met wettelijk vastgelegde vermeldingen ("btw-KASTICKET",
//   "DIT IS GEEN GELDIG BTW-KASTICKET", "PRO FORMA TICKET", ...). Die teksten maken deel uit van
//   wat de FOD certificeert; ze mogen niet meeveranderen met een vertaalronde van de app-UI.
// - De tickettaal is een instelling per vestiging (NL/FR/DE volgens het taalgebied, EN mag in
//   toeristische zones; certificatiehandleiding II, "Ontvangsten inhoud"), los van de taal van
//   wie de kassa bedient.
// - De kassa-kern is pure TypeScript zonder React; dit bestand hoort bij de fiscale release.
//
// Bronnen: NL en EN letterlijk uit de FOD-voorbeeldtickets (20260924_*_example[_EN].pdf) en de
// POS-detailbeschrijving §8.1. FR en DE staan NIET in de aangeleverde bronnen: dat is een open
// punt (PRINT-1, role-audit). De keuze hier volgt de Franse/Duitse terminologie van het KB van
// 30-12-2009 en het MB van 29-04-2024 ("ticket de caisse TVA", "MwSt.-Kassenbon") en moet vóór
// de certificatie tegen de officiële FR/DE-voorbeelden nagekeken worden.
import type { CostCenterType, NegQuantityReason } from '../fiscal/types';
import type { TicketLanguage } from './types';

export interface TicketStrings {
  kasticket: string;
  refund: string;
  notValid: string;
  proForma: string;
  preliminaryBill: string;
  training: string;
  copy: string;
  simulator: string;
  estUnit: string;
  user: string;
  terminal: string;
  ticketNo: string;
  posSerial: string;
  inputDevice: string;
  swVersion: string;
  total: string;
  paymentMethod: string;
  rounding: string;
  tip: string;
  vatHead: [string, string, string, string, string];
  fdmInfo: string;
  originalFdm: string;
  copyIssued: string;
  copyFdm: string;
  legalName: string;
  vatNo: string;
  date: string;
  operator: string;
  quantity: string;
  item: string;
  kitchen: string;
  bar: string;
  guests: string;
  costCenter: Record<CostCenterType, string>;
  // rapporten
  reportTurnover: string;
  reportUsers: string;
  reportNo: string;
  reportDate: string;
  bookingDate: string;
  bookingPeriod: string;
  start: string;
  end: string;
  first: string;
  last: string;
  events: string;
  eventLabel: Record<'N' | 'P' | 'F' | 'S' | 'I' | 'R' | 'C' | 'T', string>;
  vatOverview: string;
  departments: string;
  negQuantities: string;
  negReason: Record<NegQuantityReason, string>;
  priceChanges: string;
  invoices: string;
  payments: string;
  totalPayments: string;
  drawerOpen: string;
  users: string;
  turnoverInclVat: string;
  workIn: string;
  workOut: string;
  unknownUser: string;
}

const NL: TicketStrings = {
  kasticket: 'btw-KASTICKET',
  refund: 'REFUND',
  notValid: 'DIT IS GEEN GELDIG BTW-KASTICKET',
  proForma: 'PRO FORMA TICKET',
  preliminaryBill: 'VOORLOPIGE REKENING',
  training: 'TRAINING TICKET',
  copy: 'KOPIE TICKET',
  simulator: 'TEST: FDM-SIMULATOR',
  estUnit: 'Vestigingseenheid',
  user: 'Gebruiker',
  terminal: 'Terminal',
  ticketNo: 'Ticketnr.',
  posSerial: 'POS Serial',
  inputDevice: 'Input device',
  swVersion: 'Kassasoftware v.',
  total: 'TOTAAL',
  paymentMethod: 'Betaalwijze',
  rounding: 'Afronding',
  tip: 'Fooi',
  vatHead: ['BTW%', 'CODE', 'Ex', 'BTW', 'Bruto'],
  fdmInfo: 'FDM INFORMATIE',
  originalFdm: 'Origineel FDM informatie:',
  copyIssued: 'Kopie uitgegeven op',
  copyFdm: 'FDM informatie kopie:',
  legalName: 'Juridische naam',
  vatNo: 'BTW',
  date: 'Datum',
  operator: 'Operator',
  quantity: 'Aantal',
  item: 'Artikel',
  kitchen: 'KEUKEN',
  bar: 'BAR',
  guests: 'Aantal gasten',
  costCenter: { TABLE: 'Tafel', CHAIR: 'Stoel', ROOM: 'Kamer', CUSTOMER: 'Klant', ON_HOLD: 'In wacht', KIOSK: 'Kiosk', PLATFORM: 'Platform', WEBSHOP: 'Webshop', OTHER: 'Referentie' },
  reportTurnover: 'OMZET',
  reportUsers: 'GEBRUIKERS',
  reportNo: 'Rapport nr',
  reportDate: 'Aangemaakt',
  bookingDate: 'Boekingsdatum',
  bookingPeriod: 'Boekingsperiode',
  start: 'Start',
  end: 'Einde',
  first: 'Eerste',
  last: 'Laatste',
  events: 'Events',
  eventLabel: { N: 'Normale verkopen', P: 'Pro forma', F: 'Financieel', S: 'Sociaal', I: 'Factuur', R: 'Rapport', C: 'Kopie', T: 'Training' },
  vatOverview: 'BTW overzicht',
  departments: 'Omzet departementen',
  negQuantities: 'Correcties en terugnames',
  negReason: { REFUND: 'Terugname', CORRECTION: 'Correctie', PRICE_CHANGE: 'Prijswijziging', COST_CENTER_CHANGE: 'Overboeking', PRODUCT_SUBSTITUTION: 'Vervanging', VOUCHER: 'Waardebon', OTHER: 'Andere' },
  priceChanges: 'Kortingen en toeslagen',
  invoices: 'Facturen',
  payments: 'Betalingen',
  totalPayments: 'Totaal betalingen',
  drawerOpen: 'Geldlade geopend',
  users: 'Gebruikers',
  turnoverInclVat: 'Omzet (incl. btw)',
  workIn: 'Aanmelding',
  workOut: 'Afmelding',
  unknownUser: 'Gebruiker',
};

const EN: TicketStrings = {
  kasticket: 'VAT CASH REGISTER TICKET',
  refund: 'REFUND',
  notValid: 'THIS IS NOT A VALID VAT CASH REGISTER TICKET',
  proForma: 'PRO FORMA TICKET',
  preliminaryBill: 'PRELIMINARY BILL',
  training: 'TRAINING TICKET',
  copy: 'COPY TICKET',
  simulator: 'TEST: FDM SIMULATOR',
  estUnit: 'Establishment unit',
  user: 'User',
  terminal: 'Terminal',
  ticketNo: 'Ticketnr.',
  posSerial: 'POS Serial',
  inputDevice: 'Input device',
  swVersion: 'Cash register software v.',
  total: 'TOTAL',
  paymentMethod: 'Payment method',
  rounding: 'Rounding',
  tip: 'Tip',
  vatHead: ['VAT%', 'CODE', 'Excl.', 'VAT', 'Gross'],
  fdmInfo: 'FDM INFORMATION',
  originalFdm: 'Original FDM information:',
  copyIssued: 'Copy issued on',
  copyFdm: 'Copy FDM information:',
  legalName: 'Legal name',
  vatNo: 'VAT',
  date: 'Date',
  operator: 'Operator',
  quantity: 'Quantity',
  item: 'Item',
  kitchen: 'KITCHEN',
  bar: 'BAR',
  guests: 'Number of guests',
  costCenter: { TABLE: 'Table', CHAIR: 'Chair', ROOM: 'Room', CUSTOMER: 'Customer', ON_HOLD: 'On hold', KIOSK: 'Kiosk', PLATFORM: 'Platform', WEBSHOP: 'Webshop', OTHER: 'Reference' },
  reportTurnover: 'TURNOVER',
  reportUsers: 'USERS',
  reportNo: 'Report no',
  reportDate: 'Created',
  bookingDate: 'Booking date',
  bookingPeriod: 'Booking period',
  start: 'Start',
  end: 'End',
  first: 'First',
  last: 'Last',
  events: 'Events',
  eventLabel: { N: 'Normal sales', P: 'Pro forma', F: 'Financial', S: 'Social', I: 'Invoice', R: 'Report', C: 'Copy', T: 'Training' },
  vatOverview: 'VAT overview',
  departments: 'Turnover departments',
  negQuantities: 'Corrections and refunds',
  negReason: { REFUND: 'Refund', CORRECTION: 'Correction', PRICE_CHANGE: 'Price change', COST_CENTER_CHANGE: 'Transfer', PRODUCT_SUBSTITUTION: 'Substitution', VOUCHER: 'Voucher', OTHER: 'Other' },
  priceChanges: 'Discounts and surcharges',
  invoices: 'Invoices',
  payments: 'Payments',
  totalPayments: 'Total payments',
  drawerOpen: 'Drawer opened',
  users: 'Users',
  turnoverInclVat: 'Turnover (incl. VAT)',
  workIn: 'Work in',
  workOut: 'Work out',
  unknownUser: 'User',
};

// OPEN PUNT: niet uit een officiële FOD-bron (zie kop van dit bestand).
const FR: TicketStrings = {
  kasticket: 'TICKET DE CAISSE TVA',
  refund: 'REFUND',
  notValid: "CECI N'EST PAS UN TICKET DE CAISSE TVA VALABLE",
  proForma: 'TICKET PRO FORMA',
  preliminaryBill: 'ADDITION PROVISOIRE',
  training: 'TICKET DE FORMATION',
  copy: 'TICKET COPIE',
  simulator: 'TEST : SIMULATEUR FDM',
  estUnit: "Unité d'établissement",
  user: 'Utilisateur',
  terminal: 'Terminal',
  ticketNo: 'Ticket n°',
  posSerial: 'POS Serial',
  inputDevice: 'Appareil de saisie',
  swVersion: 'Logiciel de caisse v.',
  total: 'TOTAL',
  paymentMethod: 'Mode de paiement',
  rounding: 'Arrondi',
  tip: 'Pourboire',
  vatHead: ['TVA%', 'CODE', 'HTVA', 'TVA', 'TTC'],
  fdmInfo: 'INFORMATIONS FDM',
  originalFdm: 'Informations FDM originales :',
  copyIssued: 'Copie émise le',
  copyFdm: 'Informations FDM de la copie :',
  legalName: 'Dénomination',
  vatNo: 'TVA',
  date: 'Date',
  operator: 'Opérateur',
  quantity: 'Qté',
  item: 'Article',
  kitchen: 'CUISINE',
  bar: 'BAR',
  guests: 'Nombre de couverts',
  costCenter: { TABLE: 'Table', CHAIR: 'Chaise', ROOM: 'Chambre', CUSTOMER: 'Client', ON_HOLD: 'En attente', KIOSK: 'Borne', PLATFORM: 'Plateforme', WEBSHOP: 'Webshop', OTHER: 'Référence' },
  reportTurnover: "CHIFFRE D'AFFAIRES",
  reportUsers: 'UTILISATEURS',
  reportNo: 'Rapport n°',
  reportDate: 'Créé le',
  bookingDate: 'Date comptable',
  bookingPeriod: 'Période comptable',
  start: 'Début',
  end: 'Fin',
  first: 'Premier',
  last: 'Dernier',
  events: 'Événements',
  eventLabel: { N: 'Ventes normales', P: 'Pro forma', F: 'Financier', S: 'Social', I: 'Facture', R: 'Rapport', C: 'Copie', T: 'Formation' },
  vatOverview: 'Aperçu TVA',
  departments: 'Chiffre par département',
  negQuantities: 'Corrections et reprises',
  negReason: { REFUND: 'Reprise', CORRECTION: 'Correction', PRICE_CHANGE: 'Modification de prix', COST_CENTER_CHANGE: 'Transfert', PRODUCT_SUBSTITUTION: 'Remplacement', VOUCHER: "Bon d'achat", OTHER: 'Autre' },
  priceChanges: 'Réductions et suppléments',
  invoices: 'Factures',
  payments: 'Paiements',
  totalPayments: 'Total paiements',
  drawerOpen: 'Tiroir ouvert',
  users: 'Utilisateurs',
  turnoverInclVat: 'Chiffre (TVAC)',
  workIn: 'Arrivée',
  workOut: 'Départ',
  unknownUser: 'Utilisateur',
};

// OPEN PUNT: niet uit een officiële FOD-bron (zie kop van dit bestand).
const DE: TicketStrings = {
  kasticket: 'MWST-KASSENBON',
  refund: 'REFUND',
  notValid: 'DIES IST KEIN GÜLTIGER MWST-KASSENBON',
  proForma: 'PRO-FORMA-BON',
  preliminaryBill: 'VORLÄUFIGE RECHNUNG',
  training: 'SCHULUNGSBON',
  copy: 'KOPIE-BON',
  simulator: 'TEST: FDM-SIMULATOR',
  estUnit: 'Niederlassungseinheit',
  user: 'Benutzer',
  terminal: 'Terminal',
  ticketNo: 'Bon-Nr.',
  posSerial: 'POS Serial',
  inputDevice: 'Eingabegerät',
  swVersion: 'Kassensoftware v.',
  total: 'GESAMT',
  paymentMethod: 'Zahlungsart',
  rounding: 'Rundung',
  tip: 'Trinkgeld',
  vatHead: ['MwSt%', 'CODE', 'Netto', 'MwSt', 'Brutto'],
  fdmInfo: 'FDM-INFORMATIONEN',
  originalFdm: 'Ursprüngliche FDM-Informationen:',
  copyIssued: 'Kopie ausgestellt am',
  copyFdm: 'FDM-Informationen der Kopie:',
  legalName: 'Firmenname',
  vatNo: 'MwSt',
  date: 'Datum',
  operator: 'Bediener',
  quantity: 'Menge',
  item: 'Artikel',
  kitchen: 'KÜCHE',
  bar: 'BAR',
  guests: 'Anzahl Gäste',
  costCenter: { TABLE: 'Tisch', CHAIR: 'Stuhl', ROOM: 'Zimmer', CUSTOMER: 'Kunde', ON_HOLD: 'Wartend', KIOSK: 'Kiosk', PLATFORM: 'Plattform', WEBSHOP: 'Webshop', OTHER: 'Referenz' },
  reportTurnover: 'UMSATZ',
  reportUsers: 'BENUTZER',
  reportNo: 'Bericht Nr.',
  reportDate: 'Erstellt',
  bookingDate: 'Buchungsdatum',
  bookingPeriod: 'Buchungszeitraum',
  start: 'Beginn',
  end: 'Ende',
  first: 'Erstes',
  last: 'Letztes',
  events: 'Ereignisse',
  eventLabel: { N: 'Normale Verkäufe', P: 'Pro forma', F: 'Finanziell', S: 'Sozial', I: 'Rechnung', R: 'Bericht', C: 'Kopie', T: 'Schulung' },
  vatOverview: 'MwSt-Übersicht',
  departments: 'Umsatz Abteilungen',
  negQuantities: 'Korrekturen und Rücknahmen',
  negReason: { REFUND: 'Rücknahme', CORRECTION: 'Korrektur', PRICE_CHANGE: 'Preisänderung', COST_CENTER_CHANGE: 'Umbuchung', PRODUCT_SUBSTITUTION: 'Ersatz', VOUCHER: 'Gutschein', OTHER: 'Andere' },
  priceChanges: 'Rabatte und Zuschläge',
  invoices: 'Rechnungen',
  payments: 'Zahlungen',
  totalPayments: 'Summe Zahlungen',
  drawerOpen: 'Schublade geöffnet',
  users: 'Benutzer',
  turnoverInclVat: 'Umsatz (inkl. MwSt)',
  workIn: 'Anmeldung',
  workOut: 'Abmeldung',
  unknownUser: 'Benutzer',
};

export const TICKET_STRINGS: Record<TicketLanguage, TicketStrings> = { NL, FR, DE, EN };

export function strings(lang: TicketLanguage): TicketStrings {
  const s = TICKET_STRINGS[lang];
  if (!s) throw new Error(`PRT-08: tickettaal ${lang} niet ondersteund`);
  return s;
}
