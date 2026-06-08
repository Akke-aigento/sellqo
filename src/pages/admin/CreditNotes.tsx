import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { FileText, Download, Search, FileCode, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { useTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { CreditNoteStatus } from '@/types/creditNote';
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveDataTable, type ColumnDef } from '@/components/ui/responsive-data-table';
import { ActionsMenu, type ActionItem } from '@/components/ui/actions-menu';

export default function CreditNotesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CreditNoteStatus | 'all'>('all');

  const { creditNotes, isLoading } = useCreditNotes({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const handleDownloadPdf = async (cnId: string, existingUrl: string | null, language?: string) => {
    if (existingUrl) {
      window.open(existingUrl, '_blank');
      return;
    }
    try {
      setGeneratingId(cnId);
      const res = await invokeWithErrorBody<{ pdf_url: string }>('generate-credit-note', {
        body: { credit_note_id: cnId, language },
      });
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      if (res?.pdf_url) window.open(res.pdf_url, '_blank');
    } catch (e: any) {
      toast({
        title: 'PDF genereren mislukt',
        description: e?.message || 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setGeneratingId(null);
    }
  };

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

  type CN = (typeof creditNotes)[number];

  const buildActions = (cn: CN): ActionItem[] => {
    const items: ActionItem[] = [];
    items.push({
      label: cn.pdf_url ? 'Download PDF' : 'PDF genereren',
      icon: generatingId === cn.id
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />,
      onClick: () => handleDownloadPdf(cn.id, cn.pdf_url, (cn as any).language),
    });
    if (cn.ubl_url) {
      items.push({ label: 'Download UBL/XML', icon: <FileCode className="h-4 w-4" />, onClick: () => window.open(cn.ubl_url!, '_blank') });
    }
    if (cn.original_invoice) {
      items.push({ label: 'Originele factuur', icon: <ExternalLink className="h-4 w-4" />, onClick: () => navigate('/admin/orders/invoices') });
    }
    return items;
  };

  const columns: ColumnDef<CN>[] = [
    { id: 'number', header: 'Nummer', render: (cn) => <span className="font-medium">{cn.credit_note_number}</span> },
    { id: 'customer', header: 'Klant', render: (cn) => <span className="block max-w-[180px] truncate">{getCustomerName(cn)}</span> },
    { id: 'original', header: 'Originele factuur', priority: 'lg', render: (cn) => cn.original_invoice ? (
      <Button variant="link" className="p-0 h-auto font-normal" onClick={(e) => { e.stopPropagation(); navigate('/admin/orders/invoices'); }}>
        {cn.original_invoice.invoice_number}
        <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
    ) : '-' },
    { id: 'type', header: 'Type', priority: 'md', render: (cn) => getTypeBadge(cn.type) },
    { id: 'date', header: 'Datum', priority: 'md', render: (cn) => format(new Date(cn.issue_date), 'd MMM yyyy', { locale: nl }) },
    { id: 'amount', header: 'Bedrag', align: 'right', render: (cn) => <span className="font-medium text-destructive">-{formatCurrency(cn.total)}</span> },
    { id: 'status', header: 'Status', render: (cn) => getStatusBadge(cn.status) },
    { id: 'actions', header: '', align: 'right', width: '50px', render: (cn) => <ActionsMenu items={buildActions(cn)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('creditnote.title')}
        description={t('creditnote.description', "Beheer en bekijk alle creditnota's")}
      />

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
          <ResponsiveDataTable
            columns={columns}
            rows={creditNotes}
            getRowKey={(cn) => cn.id}
            isLoading={isLoading}
            cardModeBreakpoint="compact"
            emptyState={
              <div className="flex flex-col items-center py-6">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Geen creditnota's gevonden</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {search || statusFilter !== 'all'
                    ? 'Probeer andere zoekfilters'
                    : "Creditnota's worden aangemaakt via de factuurpagina"}
                </p>
              </div>
            }
            mobileCardRender={(cn) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{cn.credit_note_number}</div>
                    <div className="text-sm text-muted-foreground truncate">{getCustomerName(cn)}</div>
                  </div>
                  <ActionsMenu items={buildActions(cn)} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getTypeBadge(cn.type)}
                    {getStatusBadge(cn.status)}
                  </div>
                  <span className="font-medium text-destructive">-{formatCurrency(cn.total)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(cn.issue_date), 'd MMM yyyy', { locale: nl })}
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
