export function useInvoiceCompliance() { return { isCompliant: true, errorCount: 0, warningCount: 0, checks: [] }; }
export function validateIBAN(iban: string) { return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban.replace(/\s/g, '').toUpperCase()); }
export function formatIBAN(iban: string) { return iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim(); }
export function validateBelgianVATNumber() { return true; }
export function validateDutchVATNumber() { return true; }
