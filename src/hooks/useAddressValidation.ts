import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AddressSuggestion {
  street: string;
  city: string;
  postal_code: string;
  country: string;
  country_name: string;
  full_address: string;
  confidence: number;
  position?: {
    lat: number;
    lon: number;
  };
}

interface AddressValidationResult {
  valid: boolean;
  validated_address?: AddressSuggestion | null;
  original_address?: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  confidence?: number;
  suggestions?: AddressSuggestion[];
  error?: string;
}

interface AutocompleteResult {
  suggestions: AddressSuggestion[];
  error?: string;
}

export function useAddressValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<AddressValidationResult | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const validateAddress = async (address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  }): Promise<AddressValidationResult> => {
    setIsValidating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: address,
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

  const searchAddress = async (query: string, country?: string): Promise<AddressSuggestion[]> => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return [];
    }

    setIsSearching(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: { query, country },
      });

      if (error) {
        setSuggestions([]);
        return [];
      }

      const result = data as AutocompleteResult;
      setSuggestions(result.suggestions || []);
      return result.suggestions || [];
    } catch (err) {
      setSuggestions([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const resetValidation = () => {
    setResult(null);
    setSuggestions([]);
  };

  return {
    validateAddress,
    searchAddress,
    isValidating,
    isSearching,
    result,
    suggestions,
    resetValidation,
  };
}
