import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { parseCSV, normalizeCarrier, type CSVRow, type ImportResult } from '@/lib/trackingProcessor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

interface TrackingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface PreviewRow extends CSVRow {
  status: 'pending' | 'matched' | 'not_found';
  orderId?: string;
}

export function TrackingImportDialog({ open, onOpenChange, onImportComplete }: TrackingImportDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreviewRows([]);
    setParseErrors([]);
    setImportResult(null);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsValidating(true);

    try {
      const content = await selectedFile.text();
      const { rows, errors } = parseCSV(content);

      if (errors.length > 0) {
        setParseErrors(errors);
        setPreviewRows([]);
        return;
      }

      setParseErrors([]);

      // Validate orders against database
      const previewWithStatus: PreviewRow[] = await Promise.all(
        rows.map(async (row) => {
          if (!tenantId) return { ...row, status: 'not_found' as const };

          const { data } = await supabase.rpc('find_order_by_reference', {
            p_tenant_id: tenantId,
            p_reference: row.order_reference,
          });

          return {
            ...row,
            status: data ? 'matched' : 'not_found',
            orderId: data || undefined,
          };
        })
      );

      setPreviewRows(previewWithStatus);
      setStep('preview');
    } catch (error) {
      console.error('File parse error:', error);
      setParseErrors(['Failed to parse CSV file']);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!tenantId) return;

    setIsImporting(true);
    setStep('importing');

    const matchedRows = previewRows.filter(r => r.status === 'matched');
    const results: ImportResult['results'] = [];

    for (const row of matchedRows) {
      try {
        const updateData: Record<string, unknown> = {
          carrier: normalizeCarrier(row.carrier || 'other'),
          tracking_number: row.tracking_number,
          tracking_status: 'shipped',
          last_tracking_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (row.tracking_url) {
          updateData.tracking_url = row.tracking_url;
        }

        if (row.shipped_at) {
          updateData.shipped_at = row.shipped_at;
        } else {
          updateData.shipped_at = new Date().toISOString();
        }

        // Get current order status
        const { data: currentOrder } = await supabase
          .from('orders')
          .select('status')
          .eq('id', row.orderId!)
          .single();

        if (currentOrder && ['pending', 'processing'].includes(currentOrder.status)) {
          updateData.status = 'shipped';
        }

        const { error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', row.orderId!);

        if (error) {
          results.push({
            order_reference: row.order_reference,
            status: 'error',
            error: error.message,
          });
        } else {
          results.push({
            order_reference: row.order_reference,
            status: 'success',
            order_id: row.orderId,
          });
        }
      } catch (error) {
        results.push({
          order_reference: row.order_reference,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Add not found rows to results
    previewRows
      .filter(r => r.status === 'not_found')
      .forEach(row => {
        results.push({
          order_reference: row.order_reference,
          status: 'not_found',
        });
      });

    // Log import
    const matched = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status !== 'success').length;

    await supabase.from('tracking_import_log').insert({
      tenant_id: tenantId,
      import_source: 'csv',
      total_records: previewRows.length,
      matched_records: matched,
      failed_records: failed,
      import_data: { filename: file?.name, rows: previewRows.length },
    });

    setImportResult({
      total: previewRows.length,
      matched,
      failed,
      results,
    });

    setIsImporting(false);
    setStep('complete');

    if (matched > 0) {
      toast({
        title: 'Import voltooid',
        description: `${matched} van ${previewRows.length} orders bijgewerkt`,
      });
      onImportComplete?.();
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const matchedCount = previewRows.filter(r => r.status === 'matched').length;
  const notFoundCount = previewRows.filter(r => r.status === 'not_found').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Tracking CSV Importeren
          </DialogTitle>
          <DialogDescription>
            Upload een CSV bestand met tracking informatie om orders bulk bij te werken.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="csv-file" className="cursor-pointer">
                <div className="text-lg font-medium mb-2">Selecteer CSV bestand</div>
                <p className="text-sm text-muted-foreground mb-4">
                  Ondersteunde kolommen: order_reference, carrier, tracking_number, tracking_url, shipped_at
                </p>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Valideren...
                    </>
                  ) : (
                    'Bestand kiezen'
                  )}
                </Button>
              </Label>
            </div>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {parseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Voorbeeld CSV formaat:</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`order_reference,carrier,tracking_number,tracking_url,shipped_at
#0001,PostNL,3SMYPA123456,https://...,2025-01-26
#0002,China Post,LP123456789CN,,2025-01-26`}
              </pre>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {matchedCount} gevonden
                </Badge>
                {notFoundCount > 0 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {notFoundCount} niet gevonden
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {file?.name}
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{row.order_reference}</TableCell>
                      <TableCell>{row.carrier || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{row.tracking_number}</TableCell>
                      <TableCell>
                        {row.status === 'matched' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Gevonden
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Niet gevonden
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {previewRows.length > 10 && (
                <div className="p-2 text-center text-sm text-muted-foreground border-t">
                  + {previewRows.length - 10} meer rijen
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetState}>
                Annuleren
              </Button>
              <Button onClick={handleImport} disabled={matchedCount === 0}>
                {matchedCount} orders bijwerken
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Orders bijwerken...</p>
            <p className="text-sm text-muted-foreground">Even geduld a.u.b.</p>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4 py-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{importResult.matched}</div>
                <div className="text-sm text-muted-foreground">Succesvol</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{importResult.failed}</div>
                <div className="text-sm text-muted-foreground">Mislukt</div>
              </div>
            </div>

            {importResult.results.filter(r => r.status !== 'success').length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.results
                      .filter(r => r.status !== 'success')
                      .slice(0, 10)
                      .map((result, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{result.order_reference}</TableCell>
                          <TableCell>
                            {result.status === 'not_found' ? (
                              <Badge variant="secondary">Niet gevonden</Badge>
                            ) : (
                              <Badge variant="destructive">Fout</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {result.error || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Sluiten</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
