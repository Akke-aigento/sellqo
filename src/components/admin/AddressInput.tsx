import { useState, useEffect, useRef } from 'react';
import { Check, X, Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddressValidation } from '@/hooks/useAddressValidation';
import { cn } from '@/lib/utils';

// Local debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface AddressData {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface AddressInputProps {
  value: AddressData;
  onChange: (value: AddressData) => void;
  onValidated?: (valid: boolean) => void;
  disabled?: boolean;
  label?: string;
  showValidation?: boolean;
}

const COUNTRIES = [
  { code: 'NL', name: 'Nederland' },
  { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'LU', name: 'Luxemburg' },
  { code: 'AT', name: 'Oostenrijk' },
  { code: 'ES', name: 'Spanje' },
  { code: 'IT', name: 'Italië' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ierland' },
  { code: 'GB', name: 'Verenigd Koninkrijk' },
  { code: 'DK', name: 'Denemarken' },
  { code: 'SE', name: 'Zweden' },
  { code: 'FI', name: 'Finland' },
  { code: 'NO', name: 'Noorwegen' },
  { code: 'CH', name: 'Zwitserland' },
  { code: 'PL', name: 'Polen' },
  { code: 'CZ', name: 'Tsjechië' },
  { code: 'HU', name: 'Hongarije' },
];

export function AddressInput({
  value,
  onChange,
  onValidated,
  disabled,
  label = 'Adres',
  showValidation = true,
}: AddressInputProps) {
  const {
    validateAddress,
    searchAddress,
    isValidating,
    isSearching,
    result,
    suggestions,
    resetValidation,
  } = useAddressValidation();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 3) {
      searchAddress(debouncedSearch, value.country);
    }
  }, [debouncedSearch, value.country]);

  // Reset validation when address changes
  useEffect(() => {
    if (hasValidated) {
      resetValidation();
      setHasValidated(false);
    }
  }, [value.street, value.city, value.postal_code, value.country]);

  const handleValidate = async () => {
    if (!value.street && !value.city && !value.postal_code) return;

    const validationResult = await validateAddress(value);
    setHasValidated(true);

    if (onValidated) {
      onValidated(validationResult.valid);
    }

    // If we have a validated address, offer to use it
    if (validationResult.valid && validationResult.validated_address) {
      // Optionally auto-fill with validated address
    }
  };

  const handleSuggestionSelect = (suggestion: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  }) => {
    onChange({
      street: suggestion.street,
      city: suggestion.city,
      postal_code: suggestion.postal_code,
      country: suggestion.country,
    });
    setSearchQuery('');
    setShowSuggestions(false);
    setHasValidated(true);
    
    if (onValidated) {
      onValidated(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hasValidated && result && (
          <Badge 
            variant="outline" 
            className={cn(
              result.valid 
                ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200" 
                : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200"
            )}
          >
            {result.valid ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Geverifieerd
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Niet gevonden
              </>
            )}
          </Badge>
        )}
      </div>

      {/* Street with autocomplete */}
      <div className="relative">
        <Label htmlFor="street" className="text-xs text-muted-foreground">Straat en huisnummer</Label>
        <div className="relative mt-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            id="street"
            placeholder="Zoek adres..."
            value={searchQuery || value.street}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              onChange({ ...value, street: val });
              if (val.length >= 3) {
                setShowSuggestions(true);
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay hiding to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            disabled={disabled}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
            <div className="p-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm flex items-start gap-2"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{suggestion.full_address}</div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.postal_code} {suggestion.city}, {suggestion.country_name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* City and postal code */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="postal_code" className="text-xs text-muted-foreground">Postcode</Label>
          <Input
            id="postal_code"
            placeholder="1234 AB"
            value={value.postal_code}
            onChange={(e) => onChange({ ...value, postal_code: e.target.value.toUpperCase() })}
            disabled={disabled}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="city" className="text-xs text-muted-foreground">Plaats</Label>
          <Input
            id="city"
            placeholder="Amsterdam"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            disabled={disabled}
            className="mt-1"
          />
        </div>
      </div>

      {/* Country */}
      <div>
        <Label htmlFor="country" className="text-xs text-muted-foreground">Land</Label>
        <Select
          value={value.country}
          onValueChange={(val) => onChange({ ...value, country: val })}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecteer land" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Validate button */}
      {showValidation && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={disabled || isValidating || (!value.street && !value.city && !value.postal_code)}
          className="w-full"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Valideer adres
        </Button>
      )}

      {/* Validation result with suggested correction */}
      {hasValidated && result && !result.valid && result.suggestions && result.suggestions.length > 0 && (
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
            Bedoelde je misschien:
          </p>
          {result.suggestions.slice(0, 2).map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full text-left p-2 text-sm hover:bg-amber-100 dark:hover:bg-amber-900 rounded flex items-start gap-2"
              onClick={() => handleSuggestionSelect(suggestion)}
            >
              <MapPin className="h-4 w-4 text-amber-600 mt-0.5" />
              <span>{suggestion.full_address}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

