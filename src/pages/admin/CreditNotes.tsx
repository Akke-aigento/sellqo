import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { FileText, Download, Search, FileCode, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CreditNoteStatus } from '@/types/creditNote';

export default function CreditNotesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CreditNoteStatus | 'all'>('all');

  const { creditNotes, isLoading } = useCreditNotes({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: CreditNoteStatus) => {
    const variants: Record<CreditNoteStatus, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: t('creditnote.status_draft') },
      sent: { variant: 'default', label: t('creditnote.status_sent') },
      processed: { variant: 'outline', label: t('creditnote.status_processed') },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      full: t('creditnote.type_full'),
      partial: t('creditnote.type_partial'),
      correction: t('creditnote.type_correction'),
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  const getCustomerName = (creditNote: typeof creditNotes[0]) => {
    if (creditNote.customer) {
      if (creditNote.customer.company_name) return creditNote.customer.company_name;
      return `${creditNote.customer.first_name || ''} ${creditNote.customer.last_name || ''}`.trim() || creditNote.customer.email;
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('creditnote.title')}</h1>
        <p className="text-muted-foreground">
          {t('creditnote.description', 'Beheer en bekijk alle creditnota\'s')}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as CreditNoteStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="draft">{t('creditnote.status_draft')}</SelectItem>
                <SelectItem value="sent">{t('creditnote.status_sent')}</SelectItem>
                <SelectItem value="processed">{t('creditnote.status_processed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('creditnote.title')}
          </CardTitle>
          <CardDescription>
            {creditNotes.length} creditnota's gevonden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : creditNotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Geen creditnota's gevonden</h3>
              <p className="text-muted-foreground mt-1">
                {search || statusFilter !== 'all'
                  ? 'Probeer andere zoekfilters'
                  : 'Creditnota\'s worden aangemaakt via de factuurpagina'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Originele factuur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.map((creditNote) => (
                  <TableRow key={creditNote.id}>
                    <TableCell className="font-medium">
                      {creditNote.credit_note_number}
                    </TableCell>
                    <TableCell>{getCustomerName(creditNote)}</TableCell>
                    <TableCell>
                      {creditNote.original_invoice ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto font-normal"
                          onClick={() => navigate(`/admin/orders/invoices`)}
                        >
                          {creditNote.original_invoice.invoice_number}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getTypeBadge(creditNote.type)}</TableCell>
                    <TableCell>
                      {format(new Date(creditNote.issue_date), 'd MMM yyyy', { locale: nl })}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      -{formatCurrency(creditNote.total)}
                    </TableCell>
                    <TableCell>{getStatusBadge(creditNote.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {creditNote.pdf_url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(creditNote.pdf_url!, '_blank')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download PDF</TooltipContent>
                          </Tooltip>
                        )}
                        {creditNote.ubl_url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => window.open(creditNote.ubl_url!, '_blank')}
                              >
                                <FileCode className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download UBL/XML</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
