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
  reference?: string;        // Structured reference (OGM)
  text?: string;             // Free text (used if no structured reference)
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
  
  // Extract only digits from OGM for structured reference
  const reference = data.reference?.replace(/[^\d]/g, '') || '';
  const text = data.text || '';
  
  const lines = [
    'BCD',                    // Service tag (fixed)
    '002',                    // Version
    '1',                      // Character set (1=UTF-8)
    'SCT',                    // Identification (SEPA Credit Transfer)
    data.bic || '',           // BIC (optional)
    beneficiaryName,          // Beneficiary name
    iban,                     // IBAN
    `EUR${amount}`,           // Amount with currency
    '',                       // Purpose code (empty)
    reference,                // Structured reference
    text,                     // Remittance text
    ''                        // Beneficiary to originator info (empty)
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
