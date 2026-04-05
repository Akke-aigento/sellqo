/**
 * EPC QR Code Generator for SEPA Credit Transfers
 * Generates QR codes compliant with the European Payments Council standard
 * that can be scanned by banking apps for instant payment
 */

export interface EPCData {
  bic?: string;              // BIC code (optional)
  beneficiaryName: string;   // Max 70 chars
  iban: string;              // Without spaces
  amount: number;
  reference?: string;        // Unstructured remittance info (order number / OGM)
  text?: string;             // Fallback for remittance info if no reference
}

/**
 * Generate EPC QR code string according to EPC standard
 * Format: BCD\n002\n1\nSCT\n[BIC]\n[Name]\n[IBAN]\nEUR[Amount]\n\n[Reference]\n[Text]\n
 */
export function generateEPCString(data: EPCData): string {
  // Clean and validate data
  const beneficiaryName = data.beneficiaryName.slice(0, 70).trim();
  const iban = data.iban.replace(/\s/g, '').toUpperCase();
  const amount = data.amount.toFixed(2);

  // Use reference as unstructured remittance info (line 11), NOT as
  // structured creditor reference (line 10). Belgian OGM is not a valid
  // ISO 11649 structured reference — putting it in line 10 causes bank
  // apps to misparse the payload (e.g. order number shown as IBAN).
  const reference = data.reference || data.text || '';

  // EPC QR payload — EXACT 12 lines, empty lines MUST NOT be omitted
  const lines = [
    'BCD',                    // Line 1: Service Tag (always "BCD")
    '002',                    // Line 2: Version (always "002")
    '1',                      // Line 3: Character set 1=UTF-8
    'SCT',                    // Line 4: SEPA Credit Transfer
    data.bic || '',           // Line 5: BIC (may be empty for SEPA)
    beneficiaryName,          // Line 6: Beneficiary name (max 70 chars)
    iban,                     // Line 7: IBAN without spaces
    `EUR${amount}`,           // Line 8: "EUR" + amount with dot decimal
    '',                       // Line 9: Purpose code (EMPTY but MUST be present)
    '',                       // Line 10: Structured reference (EMPTY but MUST be present)
    reference,                // Line 11: Unstructured remittance info (order number)
    '',                       // Line 12: Display text (EMPTY but MUST be present)
  ];

  return lines.join('\n');
}

/**
 * Format IBAN for display with spaces every 4 characters
 */
export function formatIBAN(iban: string): string {
  return iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Validate IBAN format (basic check)
 */
export function isValidIBAN(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  // Basic length check (varies by country, but generally 15-34 chars)
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleanIban);
}

/**
 * Validate BIC format
 */
export function isValidBIC(bic: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.toUpperCase());
}
