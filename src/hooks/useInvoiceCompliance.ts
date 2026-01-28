import { useMemo } from 'react';
import { useTenant } from './useTenant';

export interface ComplianceCheck {
  id: string;
  category: 'seller' | 'invoice' | 'financial';
  label: string;
  passed: boolean;
  value: string | null;
  required: boolean;
  severity: 'error' | 'warning';
}

export interface ComplianceResult {
  checks: ComplianceCheck[];
  isCompliant: boolean;
  errorCount: number;
  warningCount: number;
}

/**
 * Belgian invoice compliance validator
 * Validates that all required fields for Belgian/EU invoices are present
 */
export function useInvoiceCompliance(): ComplianceResult {
  const { currentTenant } = useTenant();

  const checks = useMemo((): ComplianceCheck[] => {
    if (!currentTenant) return [];

    const tenantData = currentTenant as any;

    return [
      // Seller/Business information checks
      {
        id: 'company_name',
        category: 'seller',
        label: 'Bedrijfsnaam',
        passed: !!currentTenant.name?.trim(),
        value: currentTenant.name || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'address',
        category: 'seller',
        label: 'Adres',
        passed: !!currentTenant.address?.trim(),
        value: currentTenant.address || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'postal_code',
        category: 'seller',
        label: 'Postcode',
        passed: !!currentTenant.postal_code?.trim(),
        value: currentTenant.postal_code || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'city',
        category: 'seller',
        label: 'Stad/Gemeente',
        passed: !!currentTenant.city?.trim(),
        value: currentTenant.city || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'country',
        category: 'seller',
        label: 'Land',
        passed: !!currentTenant.country?.trim(),
        value: currentTenant.country || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'kvk_number',
        category: 'seller',
        label: 'Ondernemingsnummer (KBO/KvK)',
        passed: !!currentTenant.kvk_number?.trim(),
        value: currentTenant.kvk_number || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'btw_number',
        category: 'seller',
        label: 'BTW-nummer',
        passed: !!currentTenant.btw_number?.trim(),
        value: currentTenant.btw_number || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'iban',
        category: 'seller',
        label: 'IBAN bankrekeningnummer',
        passed: !!tenantData.iban?.trim(),
        value: tenantData.iban || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'phone',
        category: 'seller',
        label: 'Telefoonnummer',
        passed: !!currentTenant.phone?.trim(),
        value: currentTenant.phone || null,
        required: false,
        severity: 'warning',
      },
      {
        id: 'email',
        category: 'seller',
        label: 'E-mailadres',
        // Use billing_email if set, otherwise fallback to owner_email
        passed: !!(tenantData.billing_email?.trim() || currentTenant.owner_email?.trim()),
        value: tenantData.billing_email || currentTenant.owner_email || null,
        required: true,
        severity: 'error',
      },
      // Invoice configuration checks
      {
        id: 'invoice_prefix',
        category: 'invoice',
        label: 'Factuurnummer prefix',
        passed: !!tenantData.invoice_prefix?.trim(),
        value: tenantData.invoice_prefix || null,
        required: true,
        severity: 'error',
      },
      // Financial configuration checks
      {
        id: 'tax_percentage',
        category: 'financial',
        label: 'BTW-percentage',
        passed: currentTenant.tax_percentage != null && currentTenant.tax_percentage >= 0,
        value: currentTenant.tax_percentage?.toString() || null,
        required: true,
        severity: 'error',
      },
      {
        id: 'currency',
        category: 'financial',
        label: 'Valuta',
        passed: !!currentTenant.currency?.trim(),
        value: currentTenant.currency || null,
        required: true,
        severity: 'error',
      },
    ];
  }, [currentTenant]);

  const errorCount = checks.filter(c => !c.passed && c.severity === 'error').length;
  const warningCount = checks.filter(c => !c.passed && c.severity === 'warning').length;
  const isCompliant = errorCount === 0;

  return {
    checks,
    isCompliant,
    errorCount,
    warningCount,
  };
}

/**
 * Validates IBAN format (basic validation)
 */
export function validateIBAN(iban: string): boolean {
  if (!iban) return false;
  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  // Basic format check: 2 letters + 2 digits + up to 30 alphanumeric
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
  return ibanRegex.test(cleanIban);
}

/**
 * Validates Belgian KBO/BTW number format
 */
export function validateBelgianVATNumber(vatNumber: string): boolean {
  if (!vatNumber) return false;
  // Remove spaces and convert to uppercase
  const clean = vatNumber.replace(/\s/g, '').toUpperCase();
  // Belgian VAT: BE + 10 digits (0 or 1 followed by 9 digits)
  const beVatRegex = /^BE[01][0-9]{9}$/;
  return beVatRegex.test(clean);
}

/**
 * Validates Dutch BTW number format
 */
export function validateDutchVATNumber(vatNumber: string): boolean {
  if (!vatNumber) return false;
  // Remove spaces and convert to uppercase
  const clean = vatNumber.replace(/\s/g, '').toUpperCase();
  // Dutch VAT: NL + 9 digits + B + 2 digits
  const nlVatRegex = /^NL[0-9]{9}B[0-9]{2}$/;
  return nlVatRegex.test(clean);
}

/**
 * Formats IBAN for display with spaces every 4 characters
 */
export function formatIBAN(iban: string): string {
  if (!iban) return '';
  const clean = iban.replace(/\s/g, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}
