import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2, ShoppingCart, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  ogm_reference: string | null;
}

interface ReconciliationResult {
  transaction: BankTransaction;
  status: 'matched_order' | 'matched_platform' | 'not_found' | 'already_paid' | 'error';
  payment_id?: string;
  order_id?: string;
  order_number?: string;
  error?: string;
}

// Parse OGM from bank statement description
function extractOGM(description: string): string | null {
  // Belgian OGM format: +++XXX/XXXX/XXXXX+++ or ***XXX/XXXX/XXXXX***
  const ogmPattern = /[\+\*]{3}(\d{3}\/\d{4}\/\d{5})[\+\*]{3}/;
  const match = description.match(ogmPattern);
  if (match) return `+++${match[1]}+++`;
  
  // Also try without delimiters: 12 digits with modulo 97 check
  const numericPattern = /\b(\d{12})\b/;
  const numMatch = description.match(numericPattern);
  if (numMatch) {
    const num = numMatch[1];
    return `+++${num.slice(0, 3)}/${num.slice(3, 7)}/${num.slice(7, 12)}+++`;
  }
  
  return null;
}

// Parse CSV content from bank statement
function parseBankCSV(content: string): BankTransaction[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  
  // Find relevant columns (support multiple bank formats)
  const dateIdx = headers.findIndex(h => 
    ['date', 'datum', 'boekingsdatum', 'valutadatum', 'transaction date'].includes(h)
  );
  const descIdx = headers.findIndex(h => 
    ['description', 'omschrijving', 'mededeling', 'details', 'narrative', 'reference'].includes(h)
  );
  const amountIdx = headers.findIndex(h => 
    ['amount', 'bedrag', 'credit', 'debit', 'transaction amount'].includes(h)
  );
  
  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    console.warn('Could not find required columns', { headers, dateIdx, descIdx, amountIdx });
    return [];
  }
  
  const transactions: BankTransaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length < Math.max(dateIdx, descIdx, amountIdx) + 1) continue;
    
    const amountStr = values[amountIdx].replace(/[^\d,.-]/g, '').replace(',', '.');
    const amount = parseFloat(amountStr);
    
    // Only process incoming payments (positive amounts)
    if (isNaN(amount) || amount <= 0) continue;
    
    const description = values[descIdx];
    const ogm = extractOGM(description);
    
    transactions.push({
      date: values[dateIdx],
      description,
      amount,
      ogm_reference: ogm,
    });
  }
  
  return transactions;
}

export function BankReconciliationUpload() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setFileName(file.name);
    setResults([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseBankCSV(content);
      setTransactions(parsed);
      
      if (parsed.length === 0) {
        toast({
          title: 'Geen transacties gevonden',
          description: 'Controleer of het CSV-bestand het juiste formaat heeft',
          variant: 'destructive',
        });
      } else {
        const withOGM = parsed.filter(t => t.ogm_reference);
        toast({
          title: `${parsed.length} transacties geladen`,
          description: `${withOGM.length} met gestructureerde mededeling (OGM)`,
        });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const processReconciliation = async () => {
    if (!currentTenant?.id || transactions.length === 0) return;
    
    setIsProcessing(true);
    const reconciliationResults: ReconciliationResult[] = [];
    
    try {
      // Get pending orders with bank transfer for this tenant
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, ogm_reference, total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .eq('payment_method', 'bank_transfer')
        .eq('payment_status', 'pending')
        .not('ogm_reference', 'is', null);
      
      if (ordersError) throw ordersError;
      
      // Get pending platform payments for this tenant
      const { data: pendingPayments, error: fetchError } = await supabase
        .from('pending_platform_payments')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'pending');
      
      if (fetchError) throw fetchError;
      
      // Create lookup maps
      const ordersByOGM = new Map(
        (pendingOrders || []).map(o => [o.ogm_reference, o])
      );
      const paymentsByOGM = new Map(
        (pendingPayments || []).map(p => [p.ogm_reference, p])
      );
      
      for (const tx of transactions) {
        if (!tx.ogm_reference) {
          reconciliationResults.push({
            transaction: tx,
            status: 'not_found',
            error: 'Geen OGM gevonden',
          });
          continue;
        }
        
        // First try to match against orders
        const order = ordersByOGM.get(tx.ogm_reference);
        if (order) {
          // Verify amount matches (with small tolerance for rounding)
          if (Math.abs(order.total - tx.amount) > 0.01) {
            reconciliationResults.push({
              transaction: tx,
              status: 'error',
              order_id: order.id,
              order_number: order.order_number,
              error: `Bedrag komt niet overeen (verwacht: €${order.total.toFixed(2)})`,
            });
            continue;
          }
          
          // Update order payment status
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'processing',
            })
            .eq('id', order.id);
          
          if (updateError) {
            reconciliationResults.push({
              transaction: tx,
              status: 'error',
              order_id: order.id,
              order_number: order.order_number,
              error: updateError.message,
            });
          } else {
            // Create audit log in payment_confirmations
            await supabase
              .from('payment_confirmations')
              .insert({
                tenant_id: currentTenant.id,
                order_id: order.id,
                confirmed_by: (await supabase.auth.getUser()).data.user?.id,
                payment_method: 'bank_transfer',
                amount: tx.amount,
                notes: `Bank reconciliatie: ${tx.date} - ${tx.description}`,
                metadata: {
                  bank_reconciliation: {
                    date: tx.date,
                    description: tx.description,
                    ogm_reference: tx.ogm_reference,
                    reconciled_at: new Date().toISOString(),
                  },
                },
              });
            
            // Record transaction for usage tracking
            try {
              await supabase.rpc('record_transaction', {
                p_tenant_id: currentTenant.id,
                p_transaction_type: 'bank_transfer',
                p_order_id: order.id,
              });
            } catch (txError) {
              console.warn('Failed to record transaction:', txError);
            }
            
            reconciliationResults.push({
              transaction: tx,
              status: 'matched_order',
              order_id: order.id,
              order_number: order.order_number,
            });
          }
          continue;
        }
        
        // Then try platform payments
        const payment = paymentsByOGM.get(tx.ogm_reference);
        
        if (!payment) {
          reconciliationResults.push({
            transaction: tx,
            status: 'not_found',
            error: 'OGM niet gevonden in openstaande orders of platform betalingen',
          });
          continue;
        }
        
        // Verify amount matches (with small tolerance for rounding)
        if (Math.abs(payment.amount - tx.amount) > 0.01) {
          reconciliationResults.push({
            transaction: tx,
            status: 'error',
            payment_id: payment.id,
            error: `Bedrag komt niet overeen (verwacht: €${payment.amount.toFixed(2)})`,
          });
          continue;
        }
        
        // Mark platform payment as confirmed
        const { error: updateError } = await supabase
          .from('pending_platform_payments')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            metadata: {
              ...((payment.metadata as Record<string, unknown>) || {}),
              bank_reconciliation: {
                date: tx.date,
                description: tx.description,
                reconciled_at: new Date().toISOString(),
              },
            },
          })
          .eq('id', payment.id);
        
        if (updateError) {
          reconciliationResults.push({
            transaction: tx,
            status: 'error',
            payment_id: payment.id,
            error: updateError.message,
          });
        } else {
          reconciliationResults.push({
            transaction: tx,
            status: 'matched_platform',
            payment_id: payment.id,
          });
        }
      }
      
      setResults(reconciliationResults);
      
      const matchedOrders = reconciliationResults.filter(r => r.status === 'matched_order').length;
      const matchedPlatform = reconciliationResults.filter(r => r.status === 'matched_platform').length;
      toast({
        title: 'Reconciliatie voltooid',
        description: `${matchedOrders} klant-orders en ${matchedPlatform} platform betalingen gematcht`,
      });
      
    } catch (error) {
      console.error('Reconciliation error:', error);
      toast({
        title: 'Fout bij reconciliatie',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (result: ReconciliationResult) => {
    switch (result.status) {
      case 'matched_order':
        return (
          <Badge className="bg-green-500">
            <ShoppingCart className="h-3 w-3 mr-1" />
            Klant Order
          </Badge>
        );
      case 'matched_platform':
        return (
          <Badge className="bg-blue-500">
            <Building2 className="h-3 w-3 mr-1" />
            Platform
          </Badge>
        );
      case 'already_paid':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" /> Al betaald</Badge>;
      case 'not_found':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Niet gevonden</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Fout</Badge>;
    }
  };

  const getTypeLabel = (result: ReconciliationResult) => {
    if (result.status === 'matched_order' && result.order_number) {
      return `🛒 ${result.order_number}`;
    }
    if (result.status === 'matched_platform') {
      return '🏢 AI Credits/Add-on';
    }
    return '-';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bank Reconciliatie
        </CardTitle>
        <CardDescription>
          Upload een CSV-export van je bankafschrift om betalingen automatisch te matchen via OGM (klant-orders én platform betalingen)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-primary">Laat los om te uploaden...</p>
          ) : (
            <>
              <p className="text-muted-foreground">Sleep een CSV-bestand hierheen of klik om te selecteren</p>
              <p className="text-xs text-muted-foreground mt-2">Ondersteunt exports van KBC, BNP Paribas Fortis, ING, Belfius</p>
            </>
          )}
        </div>

        {fileName && transactions.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{fileName}</strong> - {transactions.length} transacties, {transactions.filter(t => t.ogm_reference).length} met OGM
              </p>
              <Button onClick={processReconciliation} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verwerken...
                  </>
                ) : (
                  'Start Reconciliatie'
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Bedrag</TableHead>
                      <TableHead>OGM</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{result.transaction.date}</TableCell>
                        <TableCell>€{result.transaction.amount.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {result.transaction.ogm_reference || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getTypeLabel(result)}
                        </TableCell>
                        <TableCell>{getStatusBadge(result)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {result.error || result.transaction.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
