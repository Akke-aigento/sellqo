import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ValidationWarning } from '@/hooks/useSyncValidation';
import type { SyncDataType } from '@/types/syncRules';

const LABELS: Record<SyncDataType, string> = {
  orders: 'Bestellingen',
  products: 'Producten',
  inventory: 'Voorraad',
  customers: 'Klanten',
  invoices: 'Facturen',
  returns: 'Retouren',
  shipments: 'Verzendingen',
  categories: 'Categorieën',
  taxes: 'BTW/Belastingen',
};

interface SyncValidationWarningsProps {
  warnings: ValidationWarning[];
  onDismiss?: (id: string) => void;
  onNavigateToDataType?: (dataType: SyncDataType) => void;
}

export function SyncValidationWarnings({
  warnings,
  onDismiss,
  onNavigateToDataType,
}: SyncValidationWarningsProps) {
  if (warnings.length === 0) return null;

  const errors = warnings.filter((w) => w.severity === 'error');
  const warningsOnly = warnings.filter((w) => w.severity === 'warning');
  const infos = warnings.filter((w) => w.severity === 'info');

  const getIcon = (severity: ValidationWarning['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = (severity: ValidationWarning['severity']) => {
    switch (severity) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
    }
  };

  const renderWarningGroup = (
    items: ValidationWarning[],
    title: string,
    variant: 'destructive' | 'default'
  ) => {
    if (items.length === 0) return null;

    return (
      <Alert variant={variant} className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <AlertTitle className="flex items-center gap-2">
              {getIcon(items[0].severity)}
              {title}
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <ul className="space-y-1">
                {items.map((warning) => (
                  <li key={warning.id} className="flex items-center justify-between group">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {LABELS[warning.dataType]}
                      </Badge>
                      <span className="text-sm">{warning.message}</span>
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onNavigateToDataType && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => onNavigateToDataType(warning.dataType)}
                        >
                          Bekijk
                        </Button>
                      )}
                      {onDismiss && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onDismiss(warning.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  };

  return (
    <div className="space-y-2">
      {renderWarningGroup(errors, 'Configuratie Fouten', 'destructive')}
      {renderWarningGroup(warningsOnly, 'Waarschuwingen', 'default')}
      {renderWarningGroup(infos, 'Informatie', 'default')}
    </div>
  );
}
