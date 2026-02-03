import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { detectBolCsv, BOL_REQUIRED_COLUMNS, findMatchingHeader } from '@/lib/bolCsvMapping';

interface BolCsvImportProps {
  connectionId: string;
  onImportComplete?: () => void;
}

interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export function BolCsvImport({ connectionId, onImportComplete }: BolCsvImportProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedCsvData | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const parseCSV = (text: string): ParsedCsvData => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV bestand is leeg');
    }

    // Detect delimiter (semicolon is common for Dutch exports)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    
    // Parse headers
    const headers = firstLine.split(delimiter).map(h => h.replace(/^"|"$/g, '').trim());
    
    // Parse rows
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.replace(/^"|"$/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }

    return { headers, rows, totalRows: rows.length };
  };

  const validateCsv = (data: ParsedCsvData): string[] => {
    const errors: string[] = [];
    
    // Check if it looks like a Bol.com export
    if (!detectBolCsv(data.headers)) {
      errors.push('Dit lijkt geen Bol.com export te zijn. Zorg dat je de verkoopanalyse exporteert.');
    }
    
    // Check for required columns
    for (const req of BOL_REQUIRED_COLUMNS) {
      const found = findMatchingHeader(data.headers, req.labels);
      if (!found) {
        errors.push(`Ontbrekende kolom: ${req.labels[0]}`);
      }
    }
    
    return errors;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        const errors = validateCsv(data);
        
        setParsedData(data);
        setValidationErrors(errors);
        setStep('preview');
      } catch (error) {
        toast.error('Fout bij het lezen van CSV: ' + (error instanceof Error ? error.message : 'Onbekende fout'));
      }
    };
    reader.onerror = () => {
      toast.error('Fout bij het lezen van bestand');
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    if (!parsedData) return;

    setImporting(true);
    setStep('importing');
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('import-bol-csv', {
        body: {
          connectionId,
          headers: parsedData.headers,
          rows: parsedData.rows,
        },
      });

      if (error) {
        throw error;
      }

      setResult({
        imported: data?.ordersImported || 0,
        skipped: data?.ordersSkipped || 0,
        failed: data?.ordersFailed || 0,
        errors: data?.errors || [],
      });
      setStep('result');
      
      if (data?.ordersImported > 0) {
        toast.success(`${data.ordersImported} orders succesvol geïmporteerd!`);
      }
      
      onImportComplete?.();
    } catch (error) {
      toast.error('Import mislukt: ' + (error instanceof Error ? error.message : 'Onbekende fout'));
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setStep('upload');
    setParsedData(null);
    setResult(null);
    setValidationErrors([]);
    setProgress(0);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(resetState, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          CSV Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bol.com Orders Importeren via CSV</DialogTitle>
          <DialogDescription>
            Exporteer je verkoophistorie uit Bol.com Seller Central (Verkoopanalyse) en upload hier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Zo exporteer je orders uit Bol.com:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                    <li>Ga naar Bol.com Seller Central → Verkoopanalyse</li>
                    <li>Selecteer de gewenste periode (tot 2 jaar)</li>
                    <li>Klik op "Exporteer naar Excel/CSV"</li>
                    <li>Upload het gedownloade bestand hier</li>
                  </ol>
                </AlertDescription>
              </Alert>
              
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                  transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg">Laat het bestand hier los...</p>
                ) : (
                  <>
                    <p className="text-lg mb-2">Sleep je CSV bestand hierheen</p>
                    <p className="text-sm text-muted-foreground">of klik om een bestand te selecteren</p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'preview' && parsedData && (
            <div className="space-y-4">
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc ml-4">
                      {validationErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{parsedData.totalRows} orders gevonden</span>
                </div>
                <Badge variant="outline">{parsedData.headers.length} kolommen</Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                Preview van de eerste 5 orders:
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {parsedData.headers.slice(0, 6).map((header) => (
                        <TableHead key={header} className="whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))}
                      {parsedData.headers.length > 6 && (
                        <TableHead className="text-muted-foreground">
                          +{parsedData.headers.length - 6} meer
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.rows.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx}>
                        {parsedData.headers.slice(0, 6).map((header) => (
                          <TableCell key={header} className="max-w-[150px] truncate">
                            {row[header] || '-'}
                          </TableCell>
                        ))}
                        {parsedData.headers.length > 6 && <TableCell>...</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={resetState}>
                  <X className="w-4 h-4 mr-2" />
                  Annuleren
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={validationErrors.length > 0 || importing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importeer {parsedData.totalRows} Orders
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <p className="text-lg">Orders importeren...</p>
              <p className="text-sm text-muted-foreground">
                Dit kan even duren afhankelijk van het aantal orders
              </p>
              <Progress value={progress} className="max-w-md mx-auto" />
            </div>
          )}

          {step === 'result' && result && (
            <div className="py-8 space-y-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Import Voltooid!</h3>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                  <div className="text-sm text-muted-foreground">Geïmporteerd</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                  <div className="text-sm text-muted-foreground">Overgeslagen</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-sm text-muted-foreground">Mislukt</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <Alert variant="destructive" className="max-w-md mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">Fouten tijdens import:</p>
                    <ul className="list-disc ml-4 text-sm">
                      {result.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...en {result.errors.length - 5} meer</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center pt-4">
                <Button onClick={handleClose}>
                  Sluiten
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
