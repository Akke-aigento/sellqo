// PRINT-1 — abstract ticketdocument. Eén model, drie weergaven (text.ts, escpos.ts, html.ts).
//
// WIJZIGEN IN src/kassa/ = FISCALE RELEASE. Zie src/kassa/README.md en print/README.md.
import type { AnyFiscalInput, MutationName, SignResult } from '../fiscal/types';

export type TicketLanguage = 'NL' | 'FR' | 'DE' | 'EN';

/** Soort afdruk. Bepaalt titels, verplichte en verboden velden (PRT-02..PRT-06). */
export type TicketKind =
  | 'kasticket' // N
  | 'refund' // N met enkel terugnamelijnen
  | 'voorrekening' // P / PRE_BILL
  | 'bestelbon' // P / ORDER
  | 'kopie' // C
  | 'training' // T
  | 'keuken' // keukenbon (gevolg van P)
  | 'bar' // barbon (gevolg van P)
  | 'rapport'; // R (X/Z omzet of gebruikers)

/** Een ondertekend event: het verzonden bericht + het FDM-antwoord (zelfde vorm als fiscal/reports.SignedEvent). */
export interface SignedEvent {
  name: MutationName;
  isTraining: boolean;
  data: AnyFiscalInput;
  /** Het FDM-antwoord. Zonder dit antwoord wordt er NIETS afgedrukt (PRT-09). */
  result: SignResult | null | undefined;
}

/** Gegevens van de uitbating (MB art. 20 b, c, d). */
export interface BusinessInfo {
  /** Juridische naam (maatschappelijke benaming). */
  legalName: string;
  /** Handelsnaam van de uitbating. */
  tradeName: string;
  /** Adresregels, bv. ['Koning Albert II-laan 33', '1030 Schaarbeek']. */
  address: string[];
  /** Btw-nummer; moet gelijk zijn aan vatNo in het bericht. */
  vatNo: string;
  /** Vestigingsnummer; moet gelijk zijn aan estNo in het bericht. */
  estNo: string;
}

/** Gebruiker zoals op het ticket (art. 20 h). NOOIT het INSZ (pos_detail 6.4). */
export interface StaffLabel {
  name: string;
  /** Intern nummer binnen de onderneming (bv. 'kassier03'), nooit het INSZ. */
  number?: string | null;
}

export interface TicketOptions {
  /** PRT-07: zelfde product + eenheidsprijs + btw-code samenvoegen (enkel lijnen zonder prijswijziging). */
  consolidate?: boolean;
  /** PRT-07: lijnen groeperen per departement (volgorde mag wijzigen op de afdruk). */
  groupByDepartment?: boolean;
}

export interface TicketContext {
  business: BusinessInfo;
  /** Wie het event registreerde (zelfde persoon als employeeId in het bericht). */
  staff: StaffLabel;
  /** PRT-08: tickettaal van de vestiging. Standaard de taal van het bericht. */
  language?: TicketLanguage;
  options?: TicketOptions;
  /**
   * Enkel voor gebruikersrapporten: INSZ → label. Het INSZ zelf wordt nooit afgedrukt;
   * een onbekende gebruiker verschijnt als "Gebruiker n".
   */
  staffDirectory?: Record<string, StaffLabel>;
}

export type Align = 'left' | 'center' | 'right';

export type Block =
  /** Titel. `big` = vet + dubbele hoogte. */
  | { t: 'title'; text: string; big?: boolean }
  | { t: 'text'; text: string; align?: Align; bold?: boolean }
  /** Links tekst, rechts tekst (bedrag). */
  | { t: 'kv'; left: string; right: string; bold?: boolean }
  /** Productlijn: aantal, omschrijving, lijnprijs (null = zonder bedrag), btw-code. */
  | { t: 'item'; qty: string; name: string; amount: string | null; vat: string | null; indent?: boolean }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'rule' }
  | { t: 'blank' }
  /** QR-code met de verificationUrl van de FDM (PRT-03). */
  | { t: 'qr'; data: string };

export interface TicketDoc {
  kind: TicketKind;
  language: TicketLanguage;
  /** Het event waarvan dit de afdruk is (voor de printwachtrij: dedupe, koppeling). */
  fdmRef: SignResult['fdmRef'] | null;
  /** Is de handtekening van de simulator (geen echte FDM)? Dan staat er een testbanner op. */
  simulated: boolean;
  blocks: Block[];
}

/** Afdruk geweigerd omdat een fiscale regel dat verbiedt. `rule` = eis-ID uit de eisenmatrix. */
export class PrintRefusedError extends Error {
  constructor(readonly rule: string, message: string) {
    super(`${rule}: ${message}`);
    this.name = 'PrintRefusedError';
  }
}
