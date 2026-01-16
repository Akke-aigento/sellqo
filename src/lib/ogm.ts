/**
 * Belgian Structured Communication (OGM/Gestructureerde Mededeling)
 * Format: +++XXX/XXXX/XXXXX+++ (12 digits, last 2 = modulo 97 checksum)
 */

/**
 * Generates a Belgian structured communication (OGM)
 * @param baseNumber - Invoice number or unique ID (will be converted to numeric)
 * @returns Formatted OGM string
 */
export function generateOGM(baseNumber: number | string): string {
  // Extract only digits, or use number directly
  let numericBase = typeof baseNumber === 'string' 
    ? baseNumber.replace(/\D/g, '') 
    : baseNumber.toString();
  
  // If empty after removing non-digits, use timestamp
  if (!numericBase || numericBase === '0') {
    numericBase = Date.now().toString().slice(-10);
  }
  
  // Pad to 10 digits (max value: 9999999999)
  numericBase = numericBase.slice(-10).padStart(10, '0');
  
  // Calculate modulo 97 checksum
  const baseNum = BigInt(numericBase);
  const remainder = Number(baseNum % 97n);
  const checksum = (remainder === 0 ? 97 : remainder).toString().padStart(2, '0');
  
  // Combine and format
  const full = numericBase + checksum;
  return `+++${full.slice(0, 3)}/${full.slice(3, 7)}/${full.slice(7, 12)}+++`;
}

/**
 * Validates an OGM
 * @param ogm - The OGM string to validate
 * @returns Whether the OGM is valid
 */
export function validateOGM(ogm: string): boolean {
  const digits = ogm.replace(/\D/g, '');
  if (digits.length !== 12) return false;
  
  const base = BigInt(digits.slice(0, 10));
  const checksum = parseInt(digits.slice(10, 12));
  const remainder = Number(base % 97n);
  const expectedChecksum = remainder === 0 ? 97 : remainder;
  
  return checksum === expectedChecksum;
}

/**
 * Formats an OGM for display
 * @param ogm - The OGM string (with or without formatting)
 * @returns Formatted OGM string
 */
export function formatOGM(ogm: string): string {
  const digits = ogm.replace(/\D/g, '');
  if (digits.length !== 12) return ogm;
  return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7, 12)}+++`;
}
