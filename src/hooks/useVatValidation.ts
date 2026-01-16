import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VatValidationResult {
  valid: boolean;
  vat_number?: string;
  country_code?: string;
  company_name?: string | null;
  address?: string | null;
  request_date?: string;
  error?: string;
}

export function useVatValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<VatValidationResult | null>(null);

  const validateVat = async (vatNumber: string): Promise<VatValidationResult> => {
    setIsValidating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-vat', {
        body: { vat_number: vatNumber },
      });

      if (error) {
        const errorResult = { valid: false, error: error.message };
        setResult(errorResult);
        return errorResult;
      }

      setResult(data);
      return data;
    } catch (err) {
      const errorResult = { valid: false, error: 'Validatie mislukt' };
      setResult(errorResult);
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
