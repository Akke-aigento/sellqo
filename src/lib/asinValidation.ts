/**
 * ASIN (Amazon Standard Identification Number) validation utilities
 * ASIN is a 10-character alphanumeric identifier
 */

export interface ASINValidationResult {
  isValid: boolean;
  message: string;
  formattedASIN: string;
}

/**
 * Validates an ASIN (Amazon Standard Identification Number)
 * ASIN format: 10 alphanumeric characters (letters and numbers)
 * Usually starts with B0 for products created after 2010
 */
export function validateASIN(asin: string): ASINValidationResult {
  // Remove whitespace
  const cleanASIN = asin.replace(/\s/g, '').toUpperCase();
  
  // Empty check
  if (!cleanASIN) {
    return {
      isValid: false,
      message: 'Voer een ASIN in',
      formattedASIN: '',
    };
  }

  // Length check - ASIN is exactly 10 characters
  if (cleanASIN.length !== 10) {
    return {
      isValid: false,
      message: `ASIN moet 10 tekens zijn (nu: ${cleanASIN.length})`,
      formattedASIN: cleanASIN,
    };
  }

  // Character check - must be alphanumeric
  const alphanumericRegex = /^[A-Z0-9]+$/;
  if (!alphanumericRegex.test(cleanASIN)) {
    return {
      isValid: false,
      message: 'ASIN mag alleen letters en cijfers bevatten',
      formattedASIN: cleanASIN,
    };
  }

  // Valid patterns:
  // - ISBN-10 format: starts with a digit
  // - Standard ASIN: starts with B0 (most common for modern products)
  const isISBN10Format = /^\d/.test(cleanASIN);
  const isStandardASIN = cleanASIN.startsWith('B0');
  
  // Warn if doesn't match common patterns but still valid format
  if (!isISBN10Format && !isStandardASIN) {
    return {
      isValid: true,
      message: 'ASIN geaccepteerd (ongewoon formaat)',
      formattedASIN: cleanASIN,
    };
  }

  return {
    isValid: true,
    message: isISBN10Format ? 'Geldig ISBN-10/ASIN formaat' : 'Geldig ASIN formaat',
    formattedASIN: cleanASIN,
  };
}

/**
 * Get validation status for UI display
 */
export function getASINValidationStatus(asin: string): ASINValidationResult {
  return validateASIN(asin);
}

/**
 * Check if string could be an ASIN (quick check for input)
 */
export function couldBeASIN(input: string): boolean {
  const clean = input.replace(/\s/g, '');
  return clean.length <= 10 && /^[A-Za-z0-9]*$/.test(clean);
}
