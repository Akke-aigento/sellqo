import { useState, useEffect } from 'react';
import { Check, X, Loader2, Search, Building2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useVatValidation } from '@/hooks/useVatValidation';
import { cn } from '@/lib/utils';

interface VatInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidated?: (result: {
    valid: boolean;
    company_name?: string | null;
    address?: string | null;
    service_unavailable?: boolean;
  }) => void;
  disabled?: boolean;
  className?: string;
  customerId?: string;
}

const EU_COUNTRIES = [
  { code: 'AT', name: 'Oostenrijk', prefix: 'ATU' },
  { code: 'BE', name: 'België', prefix: 'BE' },
  { code: 'BG', name: 'Bulgarije', prefix: 'BG' },
  { code: 'CY', name: 'Cyprus', prefix: 'CY' },
  { code: 'CZ', name: 'Tsjechië', prefix: 'CZ' },
  { code: 'DE', name: 'Duitsland', prefix: 'DE' },
  { code: 'DK', name: 'Denemarken', prefix: 'DK' },
  { code: 'EE', name: 'Estland', prefix: 'EE' },
  { code: 'EL', name: 'Griekenland', prefix: 'EL' },
  { code: 'ES', name: 'Spanje', prefix: 'ES' },
  { code: 'FI', name: 'Finland', prefix: 'FI' },
  { code: 'FR', name: 'Frankrijk', prefix: 'FR' },
  { code: 'HR', name: 'Kroatië', prefix: 'HR' },
  { code: 'HU', name: 'Hongarije', prefix: 'HU' },
  { code: 'IE', name: 'Ierland', prefix: 'IE' },
  { code: 'IT', name: 'Italië', prefix: 'IT' },
  { code: 'LT', name: 'Litouwen', prefix: 'LT' },
  { code: 'LU', name: 'Luxemburg', prefix: 'LU' },
  { code: 'LV', name: 'Letland', prefix: 'LV' },
  { code: 'MT', name: 'Malta', prefix: 'MT' },
  { code: 'NL', name: 'Nederland', prefix: 'NL' },
  { code: 'PL', name: 'Polen', prefix: 'PL' },
  { code: 'PT', name: 'Portugal', prefix: 'PT' },
  { code: 'RO', name: 'Roemenië', prefix: 'RO' },
  { code: 'SE', name: 'Zweden', prefix: 'SE' },
  { code: 'SI', name: 'Slovenië', prefix: 'SI' },
  { code: 'SK', name: 'Slowakije', prefix: 'SK' },
];

export function VatInput({
  value,
  onChange,
  onValidated,
  disabled,
  className,
  customerId,
}: VatInputProps) {
  const { validateVat, isValidating, result, resetValidation } = useVatValidation();
  const [hasValidated, setHasValidated] = useState(false);

  // Reset validation status when value changes
  useEffect(() => {
    if (hasValidated) {
      resetValidation();
      setHasValidated(false);
    }
  }, [value]);

  const handleValidate = async () => {
    if (!value.trim()) return;

    const validationResult = await validateVat(value, customerId);
    setHasValidated(true);

    if (onValidated) {
      onValidated({
        valid: validationResult.valid,
        company_name: validationResult.company_name,
        address: validationResult.address,
        service_unavailable: validationResult.service_unavailable,
      });
    }
  };

  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (result?.service_unavailable) {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    if (result?.valid) {
      return <Check className="h-4 w-4 text-green-600" />;
    }
    if (result && !result.valid && hasValidated) {
      return <X className="h-4 w-4 text-destructive" />;
    }
    return null;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="vat_number">BTW-nummer</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="vat_number"
            placeholder="bijv. NL123456789B01"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            disabled={disabled}
            className={cn(
              "pr-8",
              result?.valid && "border-green-500 focus-visible:ring-green-500",
              result?.service_unavailable && "border-amber-500 focus-visible:ring-amber-500",
              result && !result.valid && !result.service_unavailable && hasValidated && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {getStatusIcon()}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleValidate}
          disabled={disabled || isValidating || !value.trim()}
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Verifieer</span>
        </Button>
      </div>

      {/* Validation result */}
      {result && hasValidated && (
        <div className={cn(
          "p-3 rounded-md text-sm",
          result.valid ? "bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800" : 
          result.service_unavailable ? "bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800" :
          "bg-destructive/10 border border-destructive/20"
        )}>
          {result.valid ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700">
                  <Check className="h-3 w-3 mr-1" />
                  Geverifieerd via VIES
                </Badge>
              </div>
              {result.company_name && (
                <div className="flex items-start gap-2 mt-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{result.company_name}</p>
                    {result.address && (
                      <p className="text-muted-foreground text-xs whitespace-pre-line">{result.address}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : result.service_unavailable ? (
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span>VIES-service tijdelijk niet beschikbaar. Probeer later opnieuw.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <X className="h-4 w-4" />
              <span>{result.error || 'BTW-nummer niet gevonden in VIES'}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Voer het volledige EU BTW-nummer in inclusief landcode (bijv. NL, BE, DE)
      </p>
    </div>
  );
}
