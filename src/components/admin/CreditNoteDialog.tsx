import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Minus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useTenant } from '@/hooks/useTenant';
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { CreditNoteType, CreditNoteLine } from '@/types/creditNote';

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
  line_type: 'product' | 'shipping' | 'discount';
}

interface CreditNoteDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  invoiceLines: InvoiceLine[];
  onSuccess?: () => void;
}

export function CreditNoteDialog({
  invoiceId,
  invoiceNumber,
  invoiceLines,
  onSuccess,
}: CreditNoteDialogProps) {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { createCreditNote } = useCreditNotes();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CreditNoteType>('full');
  const [reason, setReason] = useState('');
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setType('full');
      setReason('');
      setSelectedLines(new Set(invoiceLines.map((l) => l.id)));
    }
  }, [open, invoiceLines]);

  // Update selection when type changes
  useEffect(() => {
    if (type === 'full') {
      setSelectedLines(new Set(invoiceLines.map((l) => l.id)));
    } else if (type === 'partial') {
      setSelectedLines(new Set());
    }
  }, [type, invoiceLines]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const toggleLine = (lineId: string) => {
    const newSelected = new Set(selectedLines);
    if (newSelected.has(lineId)) {
      newSelected.delete(lineId);
    } else {
      newSelected.add(lineId);
    }
    setSelectedLines(newSelected);
  };

  const getSelectedTotal = () => {
    return invoiceLines
      .filter((line) => selectedLines.has(line.id))
      .reduce((sum, line) => sum + line.line_total + line.vat_amount, 0);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;

    const linesToCredit = invoiceLines.filter((line) =>
      selectedLines.has(line.id)
    );

    const creditNoteLines: Omit<CreditNoteLine, 'id' | 'credit_note_id' | 'created_at'>[] =
      linesToCredit.map((line) => ({
        original_invoice_line_id: line.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        vat_amount: line.vat_amount,
        line_total: line.line_total,
        line_type: line.line_type,
      }));

    await createCreditNote.mutateAsync({
      original_invoice_id: invoiceId,
      type,
      reason,
      lines: creditNoteLines,
    });

    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Minus className="h-4 w-4 mr-2" />
          {t('creditnote.create')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('creditnote.create_for')} {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            {t('creditnote.description', 'Maak een creditnota aan voor deze factuur.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Credit Note Type */}
          <div className="space-y-3">
            <Label>{t('creditnote.type')}</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as CreditNoteType)}
              className="grid gap-2"
            >
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="flex-1 cursor-pointer">
                  {t('creditnote.type_full')}
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="flex-1 cursor-pointer">
                  {t('creditnote.type_partial')}
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-md border p-3">
                <RadioGroupItem value="correction" id="correction" />
                <Label htmlFor="correction" className="flex-1 cursor-pointer">
                  {t('creditnote.type_correction')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t('creditnote.reason')} *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('creditnote.reason_placeholder')}
              rows={2}
            />
          </div>

          {/* Line Selection */}
          {(type === 'partial' || type === 'correction') && (
            <div className="space-y-3">
              <Label>{t('creditnote.select_lines')}</Label>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead className="text-right">{t('common.quantity', 'Aantal')}</TableHead>
                      <TableHead className="text-right">{t('common.price')}</TableHead>
                      <TableHead className="text-right">{t('common.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceLines.map((line) => (
                      <TableRow
                        key={line.id}
                        className="cursor-pointer"
                        onClick={() => toggleLine(line.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedLines.has(line.id)}
                            onCheckedChange={() => toggleLine(line.id)}
                          />
                        </TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="text-right">{line.quantity}x</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(line.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(line.line_total + line.vat_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Total to Credit */}
          <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {t('creditnote.total_to_credit', 'Te crediteren bedrag')}:
            </span>
            <span className="text-lg font-bold">
              {formatCurrency(getSelectedTotal())}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !reason.trim() ||
              selectedLines.size === 0 ||
              createCreditNote.isPending
            }
          >
            {createCreditNote.isPending ? (
              t('common.loading')
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('creditnote.create')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
