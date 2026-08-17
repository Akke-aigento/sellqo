import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

interface VatValidationResult {
  valid: boolean;
  vat_number?: string;
  country_code?: string;
  company_name?: string | null;
  address?: string | null;
  request_date?: string;
  request_identifier?: string;
  error?: string;
  service_unavailable?: boolean;
  /** VIES-FIX: false wanneer VIES geen definitieve uitkomst gaf (onbeschikbaar / formaatfout). */
  definitive?: boolean;
}

export function useVatValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<VatValidationResult | null>(null);
  const { currentTenant } = useTenant();

  const logValidation = async (
    validationResult: VatValidationResult,
    customerId?: string
  ) => {
    if (!currentTenant) return;

    try {
      await supabase.from('vat_validations').insert({
        tenant_id: currentTenant.id,
        customer_id: customerId || null,
        vat_number: validationResult.vat_number || '',
        country_code: validationResult.country_code || '',
        is_valid: validationResult.valid,
        company_name: validationResult.company_name || null,
        company_address: validationResult.address || null,
        vies_request_id: validationResult.request_identifier || null,
      });
    } catch (error) {
      console.error('Failed to log VAT validation:', error);
    }
  };

  const validateVat = async (
    vatNumber: string,
    customerId?: string
  ): Promise<VatValidationResult> => {
    setIsValidating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-vat', {
        body: { vat_number: vatNumber },
      });

      if (error) {
        const errorResult: VatValidationResult = { 
          valid: false, 
          error: error.message,
          vat_number: vatNumber.replace(/[\s.-]/g, '').toUpperCase(),
          country_code: vatNumber.replace(/[\s.-]/g, '').substring(0, 2).toUpperCase(),
        };
        setResult(errorResult);
        // VIES-FIX: transportfout is geen definitieve afkeuring → niet loggen.
        return errorResult;
      }

      // Check if VIES was unavailable
      // VIES-FIX: niet-definitieve uitkomsten nooit loggen als is_valid=false.
      if (data.service_unavailable || data.definitive === false || data.error) {
        const unavailableResult: VatValidationResult = {
          ...data,
          service_unavailable: !!data.service_unavailable,
        };
        setResult(unavailableResult);
        return unavailableResult;
      }

      setResult(data);
      
      // Log successful validation
      await logValidation(data, customerId);
      
      return data;
    } catch (err) {
      const errorResult: VatValidationResult = { 
        valid: false, 
        error: 'Validatie mislukt',
        vat_number: vatNumber.replace(/[\s.-]/g, '').toUpperCase(),
        country_code: vatNumber.replace(/[\s.-]/g, '').substring(0, 2).toUpperCase(),
      };
      setResult(errorResult);
      // VIES-FIX: onbekende fout is geen definitieve afkeuring → niet loggen.
      return errorResult;
    } finally {
      setIsValidating(false);
    }
  };

  const resetValidation = () => {
    setResult(null);
  };

  return {
    validateVat,
    isValidating,
    result,
    resetValidation,
  };
}
