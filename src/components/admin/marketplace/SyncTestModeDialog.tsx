import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FlaskConical, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Clock,
  FileText,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SyncDataType, SyncDirection } from '@/types/syncRules';

interface TestResult {
  success: boolean;
  dataType: string;
  direction: string;
  sampleSize: number;
  wouldProcess: number;
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
  validationErrors: string[];
  sampleRecords: Array<{
    id: string;
    action: 'create' | 'update' | 'skip';
    reason?: string;
    preview?: Record<string, unknown>;
  }>;
  estimatedDuration: string;
  warnings: string[];
}

interface SyncTestModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  dataType: SyncDataType;
  direction: SyncDirection;
  platformName: string;
  onConfirmSync?: () => void;
}

export function SyncTestModeDialog({
  open,
  onOpenChange,
  connectionId,
  dataType,
  direction,
  platformName,
  onConfirmSync,
}: SyncTestModeDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleRunTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-sync-rules', {
        body: {
          connectionId,
          dataType,
          direction: direction === 'bidirectional' ? 'import' : direction,
          sampleSize: 10,
        },
      });

      if (error) throw error;
      setResult(data as TestResult);
    } catch (err) {
      console.error('Test sync error:', err);
      toast.error('Test kon niet worden uitgevoerd');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSync = () => {
    onOpenChange(false);
    onConfirmSync?.();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'update':
        return <ArrowRight className="h-4 w-4 text-blue-500" />;
      case 'skip':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return 'Nieuw';
      case 'update':
        return 'Update';
      case 'skip':
        return 'Overslaan';
      default:
        return action;
    }
  };

  const dataTypeLabels: Record<string, string> = {
    orders: 'Bestellingen',
    products: 'Producten',
    inventory: 'Voorraad',
    customers: 'Klanten',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            Test Modus - Dry Run
          </DialogTitle>
          <DialogDescription>
            Simuleer de synchronisatie zonder daadwerkelijk data te wijzigen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Test Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Platform</span>
              <Badge variant="outline">{platformName}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data type</span>
              <Badge variant="secondary">{dataTypeLabels[dataType] || dataType}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Richting</span>
              <Badge>
                {direction === 'import' ? 'Importeren' : direction === 'export' ? 'Exporteren' : 'Bidirectioneel'}
              </Badge>
            </div>
          </div>

          {!result && !isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  Klik op "Start Test" om een simulatie uit te voeren
                </p>
                <Button onClick={handleRunTest}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Test
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
                <p className="text-muted-foreground">Test wordt uitgevoerd...</p>
              </div>
            </div>
          )}

          {result && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{result.wouldProcess}</div>
                    <div className="text-xs text-muted-foreground">Totaal</div>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{result.wouldCreate}</div>
                    <div className="text-xs text-muted-foreground">Nieuw</div>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{result.wouldUpdate}</div>
                    <div className="text-xs text-muted-foreground">Updates</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{result.wouldSkip}</div>
                    <div className="text-xs text-muted-foreground">Overslaan</div>
                  </div>
                </div>

                {/* Estimated Duration */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Geschatte duur:</span>
                  <span className="font-medium">{result.estimatedDuration}</span>
                </div>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Waarschuwingen
                    </h4>
                    <div className="space-y-1">
                      {result.warnings.map((warning, i) => (
                        <div key={i} className="text-sm text-amber-600 bg-amber-500/10 rounded px-3 py-2">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Errors */}
                {result.validationErrors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      Validatie fouten
                    </h4>
                    <div className="space-y-1">
                      {result.validationErrors.map((error, i) => (
                        <div key={i} className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Sample Records */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Voorbeeld records ({result.sampleRecords.length})
                  </h4>
                  <div className="space-y-2">
                    {result.sampleRecords.map((record) => (
                      <div
                        key={record.id}
                        className="bg-muted/30 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">
                            {record.id}
                          </code>
                          <Badge 
                            variant={record.action === 'skip' ? 'secondary' : 'default'}
                            className="flex items-center gap-1"
                          >
                            {getActionIcon(record.action)}
                            {getActionLabel(record.action)}
                          </Badge>
                        </div>
                        {record.reason && (
                          <p className="text-xs text-muted-foreground">{record.reason}</p>
                        )}
                        {record.preview && (
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(record.preview, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          <div className="flex gap-2">
            {result && (
              <Button variant="outline" onClick={handleRunTest} disabled={isLoading}>
                <Play className="h-4 w-4 mr-2" />
                Opnieuw testen
              </Button>
            )}
            {result && result.validationErrors.length === 0 && onConfirmSync && (
              <Button onClick={handleConfirmSync}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Voer echte sync uit
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
