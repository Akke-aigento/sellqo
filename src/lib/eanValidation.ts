/**
 * EAN-13 validation utility
 * Validates European Article Numbers (barcodes) used by Bol.com
 */

/**
 * Validates an EAN-13 code
 * @param ean The EAN code to validate
 * @returns true if valid EAN-13, false otherwise
 */
export function isValidEAN13(ean: string): boolean {
  // Remove whitespace
  const cleanEan = ean.replace(/\s/g, '');
  
  // Must be exactly 13 digits
  if (!/^\d{13}$/.test(cleanEan)) {
    return false;
  }
  
  // Calculate checksum
  const digits = cleanEan.split('').map(Number);
  const checkDigit = digits[12];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  
  return checkDigit === calculatedCheckDigit;
}

/**
 * Validates an EAN code (supports EAN-8, EAN-13, UPC-A)
 * @param ean The EAN code to validate
 * @returns true if valid EAN, false otherwise
 */
export function isValidEAN(ean: string): boolean {
  const cleanEan = ean.replace(/\s/g, '');
  
  // EAN-13 or UPC-A (12 digits, we pad to 13)
  if (/^\d{12,13}$/.test(cleanEan)) {
    const paddedEan = cleanEan.padStart(13, '0');
    return isValidEAN13(paddedEan);
  }
  
  // EAN-8
  if (/^\d{8}$/.test(cleanEan)) {
    const digits = cleanEan.split('').map(Number);
    const checkDigit = digits[7];
    
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += digits[i] * (i % 2 === 0 ? 3 : 1);
    }
    
    const calculatedCheckDigit = (10 - (sum % 10)) % 10;
    return checkDigit === calculatedCheckDigit;
  }
  
  return false;
}

/**
 * Formats an EAN code for display
 * @param ean The EAN code to format
 * @returns Formatted EAN string
 */
export function formatEAN(ean: string): string {
  const cleanEan = ean.replace(/\s/g, '');
  
  if (cleanEan.length === 13) {
    // Format as: X XXXXXX XXXXXX
    return `${cleanEan.slice(0, 1)} ${cleanEan.slice(1, 7)} ${cleanEan.slice(7)}`;
  }
  
  return cleanEan;
}

/**
 * Gets validation status and message for an EAN code
 */
export function getEANValidationStatus(ean: string): {
  isValid: boolean;
  message: string;
} {
  if (!ean || ean.trim() === '') {
    return { isValid: false, message: 'EAN code is verplicht' };
  }
  
  const cleanEan = ean.replace(/\s/g, '');
  
  if (!/^\d+$/.test(cleanEan)) {
    return { isValid: false, message: 'EAN mag alleen cijfers bevatten' };
  }
  
  if (cleanEan.length < 8) {
    return { isValid: false, message: 'EAN moet minimaal 8 cijfers bevatten' };
  }
  
  if (cleanEan.length > 13) {
    return { isValid: false, message: 'EAN mag maximaal 13 cijfers bevatten' };
  }
  
  if (!isValidEAN(cleanEan)) {
    return { isValid: false, message: 'Ongeldige EAN checksum' };
  }
  
  return { isValid: true, message: 'Geldige EAN code' };
}
