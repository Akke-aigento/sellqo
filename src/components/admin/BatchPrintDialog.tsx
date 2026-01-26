import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Printer, 
  Download, 
  Monitor, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Package
} from 'lucide-react';
import { 
  useBatchLabelPrint, 
  type PrintMethod, 
  type BatchPrintStatus 
} from '@/hooks/useBatchLabelPrint';

interface BatchPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderIds: string[];
  onComplete?: () => void;
}

export function BatchPrintDialog({ 
  open, 
  onOpenChange, 
  orderIds,
  onComplete 
}: BatchPrintDialogProps) {
  const [printMethod, setPrintMethod] = useState<PrintMethod>('browser');
  const [statuses, setStatuses] = useState<BatchPrintStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { 
    batchPrint, 
    isPrinting, 
    progress, 
    resetProgress,
    hasConnectedPrinter,
    fetchLabelsForOrders 
  } = useBatchLabelPrint();

  // Fetch label statuses when dialog opens
  useEffect(() => {
    if (open && orderIds.length > 0) {
      setIsLoading(true);
      fetchLabelsForOrders(orderIds)
        .then(setStatuses)
        .finally(() => setIsLoading(false));
    }
  }, [open, orderIds, fetchLabelsForOrders]);

  // Update statuses from progress
  useEffect(() => {
    if (progress?.statuses) {
      setStatuses(progress.statuses);
    }
  }, [progress?.statuses]);

  const handlePrint = async () => {
    const results = await batchPrint(orderIds, printMethod);
    setStatuses(results);
    onComplete?.();
  };

  const handleClose = () => {
    if (!isPrinting) {
      resetProgress();
      onOpenChange(false);
    }
  };

  const labelsAvailable = statuses.filter(s => s.status !== 'no_label').length;
  const noLabels = statuses.filter(s => s.status === 'no_label').length;
  const successCount = statuses.filter(s => s.status === 'success').length;
  const errorCount = statuses.filter(s => s.status === 'error').length;
  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  const getStatusIcon = (status: BatchPrintStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'no_label':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'printing':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: BatchPrintStatus['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Geprint</Badge>;
      case 'error':
        return <Badge variant="destructive">Mislukt</Badge>;
      case 'no_label':
        return <Badge variant="secondary">Geen label</Badge>;
      case 'printing':
        return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Bezig...</Badge>;
      default:
        return <Badge variant="outline">Wachten</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Labels Printen ({orderIds.length} orders)
          </DialogTitle>
          <DialogDescription>
            Selecteer een print methode en start het printen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order list */}
          <ScrollArea className="h-[200px] rounded-md border p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {statuses.map((status) => (
                  <div 
                    key={status.orderId}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.status)}
                      <span className="font-medium">{status.orderNumber}</span>
                      {status.carrier && (
                        <span className="text-sm text-muted-foreground">({status.carrier})</span>
                      )}
                    </div>
                    {getStatusBadge(status.status)}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Totaal: <strong>{labelsAvailable}</strong> labels beschikbaar
            </span>
            {noLabels > 0 && (
              <span className="text-orange-600">
                {noLabels} zonder label
              </span>
            )}
          </div>

          {/* Print method selection */}
          {!isPrinting && successCount === 0 && (
            <div className="space-y-3">
              <Label>Print methode</Label>
              <RadioGroup
                value={printMethod}
                onValueChange={(v) => setPrintMethod(v as PrintMethod)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="webusb" id="webusb" disabled={!hasConnectedPrinter} />
                  <Label htmlFor="webusb" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Printer className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Direct printen</div>
                      <div className="text-xs text-muted-foreground">
                        {hasConnectedPrinter ? 'Via aangesloten labelprinter' : 'Geen printer verbonden'}
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="browser" id="browser" />
                  <Label htmlFor="browser" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Monitor className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Browser print dialoog</div>
                      <div className="text-xs text-muted-foreground">
                        Opent samengevoegde PDF in nieuwe tab
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="download" id="download" />
                  <Label htmlFor="download" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Download className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Download als PDF</div>
                      <div className="text-xs text-muted-foreground">
                        Download alle labels als één PDF bestand
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Progress bar */}
          {isPrinting && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Voortgang</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <Progress value={progressPercent} />
            </div>
          )}

          {/* Results summary */}
          {!isPrinting && (successCount > 0 || errorCount > 0) && (
            <div className="flex gap-4 text-sm p-3 rounded-md bg-muted">
              {successCount > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {successCount} succesvol
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {errorCount} mislukt
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPrinting}>
            {successCount > 0 ? 'Sluiten' : 'Annuleren'}
          </Button>
          {successCount === 0 && (
            <Button 
              onClick={handlePrint} 
              disabled={isPrinting || labelsAvailable === 0}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bezig...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Start Printen
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
