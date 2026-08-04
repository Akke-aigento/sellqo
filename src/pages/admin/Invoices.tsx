import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { FileText, Download, Mail, Search, ExternalLink, FileCode, CheckCircle, Clock, Network } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useInvoices } from '@/hooks/useInvoices';
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { useDocumentDownload } from '@/hooks/useDocumentDownload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InvoiceStatusBadge } from '@/components/admin/InvoiceStatusBadge';
import { ManualInvoiceDialog } from '@/components/admin/ManualInvoiceDialog';
import { OrderMarketplaceBadge } from '@/components/admin/marketplace/OrderMarketplaceBadge';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import type { InvoiceStatus } from '@/types/invoice';
import { CreateCreditNoteFromInvoiceButton } from '@/components/admin/CreateCreditNoteFromInvoiceButton';
import { RefundInvoiceButton } from '@/components/admin/RefundInvoiceButton';
import { CreditNotesTable } from '@/components/admin/CreditNotesTable';
import { ResponsiveDataTable, type ColumnDef } from '@/components/ui/responsive-data-table';
import { ActionsMenu, type ActionItem } from '@/components/ui/actions-menu';
import { PermissionGate } from '@/components/PermissionGate';
import { ReadOnlyBadge } from '@/components/permissions/ReadOnlyBadge';
import { useCan } from '@/hooks/useCan';
import { useOdooSyncStatuses } from '@/hooks/useOdooSyncStatuses';
import { OdooSyncBadge } from '@/components/admin/OdooSyncBadge';

export default function InvoicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { openDocument } = useDocumentDownload();
  const { data: odooSync } = useOdooSyncStatuses(currentTenant?.id);
  // H4d: gate write-acties (Peppol mark-sent + resend).
  const canWriteInvoices = useCan('write', 'invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [peppolPendingOnly, setPeppolPendingOnly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'all' | 'invoices' | 'creditnotes' | null) || 'all';
  const [tab, setTab] = useState<'all' | 'invoices' | 'creditnotes'>(
    initialTab === 'invoices' || initialTab === 'creditnotes' ? initialTab : 'all',
  );

  // Keep URL ?tab=... in sync with active tab (replace, no history spam).
  useEffect(() => {
    const current = searchParams.get('tab');
    if (tab === 'all') {
      if (current) {
        const next = new URLSearchParams(searchParams);
        next.delete('tab');
        setSearchParams(next, { replace: true });
      }
    } else if (current !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const { invoices, isLoading, resendInvoice, markPeppolSent, refundInvoice, refetch } = useInvoices({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    peppolPending: peppolPendingOnly || undefined,
  });
  const { creditNotes, isLoading: cnLoading } = useCreditNotes({
    search: search || undefined,
  });

  type Combined = {
    kind: 'invoice' | 'creditnote';
    id: string;
    number: string;
    date: string;
    amount: number;
    status: string;
    customer: string;
    invoiceId?: string;
    invoiceNumber?: string;
    pdfUrl?: string | null;
    ublUrl?: string | null;
    pdfPath?: string | null;
    ublPath?: string | null;
    peppolStatus?: string | null;
    language?: string | null;
    refundedAt?: string | null;
  };

  const combined: Combined[] = useMemo(() => {
    const fromInvoices: Combined[] = invoices.map((i) => ({
      kind: 'invoice',
      id: i.id,
      number: i.invoice_number,
      date: i.created_at,
      amount: Number(i.total || 0),
      status: i.status,
      customer: i.customers
        ? `${i.customers.first_name || ''} ${i.customers.last_name || ''}`.trim() || i.customers.email
        : i.orders?.customer_name || 'Onbekend',
      invoiceId: i.id,
      invoiceNumber: i.invoice_number,
      pdfUrl: i.pdf_url,
      ublUrl: i.ubl_url,
      pdfPath: (i as any).pdf_path ?? null,
      ublPath: (i as any).ubl_path ?? null,
      peppolStatus: (i as any).peppol_status ?? null,
      language: (i as any).language ?? null,
      refundedAt: ((i as any).metadata?.stripe_refund_id ?? null) ? 'refunded' : null,
      dunning_level: (i as any).dunning_level ?? 0,
    }));
    const fromCNs: Combined[] = creditNotes.map((c: any) => ({
      kind: 'creditnote',
      id: c.id,
      number: c.credit_note_number,
      date: c.issue_date || c.created_at,
      amount: -Math.abs(Number(c.total || 0)),
      status: c.status,
      customer: c.customer
        ? c.customer.company_name || `${c.customer.first_name || ''} ${c.customer.last_name || ''}`.trim() || c.customer.email
        : '—',
      invoiceId: c.original_invoice?.id,
      invoiceNumber: c.original_invoice?.invoice_number,
      pdfUrl: c.pdf_url ?? null,
      ublUrl: c.ubl_url ?? null,
      pdfPath: c.pdf_path ?? null,
      // Credit-note UBL lives in the peppol-archive bucket (not credit-notes),
      // so we intentionally don't route it through get-document-url. The
      // legacy `window.open(cn.ubl_url)` on r.263 stays untouched.
      ublPath: null,
      peppolStatus: c.peppol_status ?? null,
      language: c.language ?? null,
    }));
    return [...fromInvoices, ...fromCNs].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [invoices, creditNotes]);

  // Invoice ids that already have a (non-cancelled) credit note.
  const invoiceIdsWithCreditNote = useMemo(() => {
    const set = new Set<string>();
    (creditNotes as any[]).forEach((c) => {
      if (c.status === 'cancelled') return;
      const id = c.original_invoice_id ?? c.original_invoice?.id;
      if (id) set.add(id as string);
    });
    return set;
  }, [creditNotes]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currentTenant?.currency || 'EUR',
    }).format(amount);
  };

  const getCustomerDisplay = (invoice: typeof invoices[0]) => {
    if (invoice.customers) {
      return {
        name: `${invoice.customers.first_name} ${invoice.customers.last_name}`.trim(),
        email: invoice.customers.email,
      };
    }
    if (invoice.orders) {
      return {
        name: invoice.orders.customer_name || 'Onbekend',
        email: null,
      };
    }
    return { name: 'Onbekend', email: null };
  };

  const getPeppolStatusBadge = (invoice: any) => {
    if (!invoice.peppol_status) return null;

    if (invoice.peppol_status === 'pending') {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          {t('peppol.status_pending')}
        </Badge>
      );
    }

    if (invoice.peppol_status === 'manual_action') {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
          <Clock className="h-3 w-3 mr-1" />
          Peppol handmatig
        </Badge>
      );
    }

    if (invoice.peppol_status === 'sent') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Peppol verzonden
        </Badge>
      );
    }

    if (invoice.peppol_status === 'archive_only') {
      return (
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
          Archief
        </Badge>
      );
    }

    if (invoice.peppol_status === 'not_applicable') {
      return null;
    }

    return null;
  };

  // Count peppol invoices that need attention (pending charge OR manual action)
  const peppolPendingCount = invoices.filter(inv =>
    ['pending', 'manual_action'].includes((inv as any).peppol_status),
  ).length;

  // Credit-note PDF download.
  // Popup-safe: open the window synchronously inside the click, then swap
  // its location once the (possibly newly generated) signed URL is ready.
  const handleCnDownloadPdf = async (
    cnId: string,
    existingPath: string | null | undefined,
    language?: string | null,
  ) => {
    const win = window.open('', '_blank');
    try {
      if (!existingPath) {
        await invokeWithErrorBody('generate-credit-note', {
          body: { credit_note_id: cnId, language: language ?? undefined },
        });
        await queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      }
      const res = await invokeWithErrorBody<{ url: string }>('get-document-url', {
        body: { doc_type: 'credit_note', doc_id: cnId, kind: 'pdf' },
      });
      if (!res?.url) throw new Error('Geen download-URL ontvangen');
      if (win && !win.closed) win.location.href = res.url;
      else window.location.href = res.url;
    } catch (e: any) {
      try { win?.close(); } catch { /* noop */ }
      toast({
        title: 'Downloaden mislukt',
        description: e?.message || 'Onbekende fout',
        variant: 'destructive',
      });
    }
  };

  const handleCnResend = async (cnId: string, language?: string | null) => {
    try {
      await invokeWithErrorBody('send-credit-note-email', {
        body: { credit_note_id: cnId, language: language ?? undefined },
      });
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast({ title: 'E-mail verzonden', description: 'De creditnota is opnieuw naar de klant verstuurd.' });
    } catch (e: any) {
      toast({ title: 'E-mail versturen mislukt', description: e?.message || 'Onbekende fout', variant: 'destructive' });
    }
  };

  // Build per-row action menu items for the combined "Alle" tab.
  const buildCombinedActions = (r: Combined): ActionItem[] => {
    const items: ActionItem[] = [];
    if (r.kind === 'invoice') {
      if (r.pdfPath) items.push({ label: 'Download PDF', icon: <Download className="h-4 w-4" />, onClick: () => openDocument('invoice', r.id, 'pdf') });
      if (r.ublPath) items.push({ label: t('peppol.download_ubl'), icon: <FileCode className="h-4 w-4" />, onClick: () => openDocument('invoice', r.id, 'ubl') });
      if (canWriteInvoices && ['pending','manual_action'].includes(r.peppolStatus as string)) {
        items.push({ label: t('peppol.mark_as_sent'), icon: <CheckCircle className="h-4 w-4" />, onClick: () => markPeppolSent.mutate(r.id) });
      }
      if (canWriteInvoices) {
        items.push({ label: 'Opnieuw versturen', icon: <Mail className="h-4 w-4" />, onClick: () => resendInvoice.mutate(r.id) });
      }
      if (r.invoiceId) {
        items.push({
          render: () => (
            <CreateCreditNoteFromInvoiceButton
              invoiceId={r.invoiceId}
              invoiceNumber={r.invoiceNumber!}
              onSuccess={() => refetch()}
              variant="menuItem"
            />
          ),
        });
      }
      if (canWriteInvoices && r.status === 'paid') {
        items.push({
          separator: true,
          render: () => (
            <RefundInvoiceButton
              amountLabel={formatCurrency(r.amount)}
              hasRefund={!!r.refundedAt}
              hasCreditNote={invoiceIdsWithCreditNote.has(r.id)}
              onConfirm={() => refundInvoice.mutateAsync(r.id)}
            />
          ),
        });
      }
    } else {
      items.push({
        label: r.pdfPath ? 'Download PDF' : 'PDF genereren',
        icon: <Download className="h-4 w-4" />,
        onClick: () => handleCnDownloadPdf(r.id, r.pdfPath, r.language),
      });
      if (r.ublUrl) items.push({ label: 'Download UBL/XML', icon: <FileCode className="h-4 w-4" />, onClick: () => window.open(r.ublUrl!, '_blank') });
      items.push({ label: 'E-mail opnieuw versturen', icon: <Mail className="h-4 w-4" />, onClick: () => handleCnResend(r.id, r.language) });
      if (r.invoiceId) {
        items.push({ label: 'Originele factuur', icon: <ExternalLink className="h-4 w-4" />, onClick: () => setTab('invoices') });
      }
      items.push({ label: "Open in Creditnota's tab", icon: <ExternalLink className="h-4 w-4" />, onClick: () => setTab('creditnotes') });
    }
    return items;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Facturen &amp; creditnota's
            <ReadOnlyBadge resource="invoices" />
          </h1>
          <p className="text-muted-foreground">
            Beheer en bekijk alle facturen en creditnota's
          </p>
        </div>
        <PermissionGate action="write" resource="invoices">
          <ManualInvoiceDialog onSuccess={() => refetch()} />
        </PermissionGate>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="invoices">Facturen</TabsTrigger>
          <TabsTrigger value="creditnotes">Creditnota's</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoeken op nummer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Gecombineerd overzicht
              </CardTitle>
              <CardDescription>{combined.length} regels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveDataTable<Combined>
                rows={combined}
                getRowKey={(r) => `${r.kind}-${r.id}`}
                isLoading={isLoading || cnLoading}
                cardModeBreakpoint="compact"
                emptyState={<div className="py-6 text-center text-muted-foreground">Geen documenten gevonden</div>}
                columns={[
                  {
                    id: 'type',
                    header: 'Type',
                    render: (r) => r.kind === 'invoice'
                      ? <Badge variant="default">Factuur</Badge>
                      : <Badge variant="outline" className="border-destructive/40 text-destructive whitespace-nowrap">Creditnota</Badge>,
                  },
                  {
                    id: 'number',
                    header: 'Nummer',
                    render: (r) => <span className="font-medium whitespace-nowrap">{r.number}</span>,
                  },
                  {
                    id: 'customer',
                    header: 'Klant',
                    priority: 'lg',
                    render: (r) => <span className="block max-w-[200px] truncate">{r.customer}</span>,
                  },
                  {
                    id: 'date',
                    header: 'Datum',
                    priority: 'md',
                    render: (r) => <span className="whitespace-nowrap">{format(new Date(r.date), 'd MMM yyyy', { locale: nl })}</span>,
                  },
                  {
                    id: 'amount',
                    header: 'Bedrag',
                    align: 'right',
                    render: (r) => (
                      <span className={`whitespace-nowrap font-medium ${r.amount < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(r.amount)}
                      </span>
                    ),
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    render: (r) => (
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Badge variant="secondary">{r.status}</Badge>
                        {r.kind === 'invoice' && (r as any).dunning_level > 0 && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                            H{(r as any).dunning_level}
                          </Badge>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'actions',
                    header: '',
                    align: 'right',
                    width: '90px',
                    render: (r) => (
                  <div className="flex items-center justify-end gap-1">
                        <ActionsMenu items={buildCombinedActions(r)} />
                      </div>
                    ),
                  },
                ] satisfies ColumnDef<Combined>[]}
                mobileCardRender={(r) => {
                  const actions = buildCombinedActions(r);
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {r.kind === 'invoice'
                              ? <Badge variant="default">Factuur</Badge>
                              : <Badge variant="outline" className="border-destructive/40 text-destructive">Creditnota</Badge>}
                            <span className="font-medium truncate">{r.number}</span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate mt-1">{r.customer}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`whitespace-nowrap font-medium ${r.amount < 0 ? 'text-destructive' : ''}`}>
                            {formatCurrency(r.amount)}
                          </span>
                          <ActionsMenu items={actions} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{format(new Date(r.date), 'd MMM yyyy', { locale: nl })}</span>
                        <Badge variant="secondary">{r.status}</Badge>
                      </div>
                    </div>
                  );
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoeken op factuurnummer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="draft">Concept</SelectItem>
                  <SelectItem value="sent">Verstuurd</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                  <SelectItem value="cancelled">Geannuleerd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Peppol filter */}
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <Network className="h-5 w-5 text-primary" />
              <div className="flex items-center space-x-2">
                <Switch
                  id="peppol-pending"
                  checked={peppolPendingOnly}
                  onCheckedChange={setPeppolPendingOnly}
                />
                <Label htmlFor="peppol-pending" className="cursor-pointer">
                  {t('peppol.status_pending')} alleen
                  {peppolPendingCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {peppolPendingCount}
                    </Badge>
                  )}
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Alle facturen
          </CardTitle>
          <CardDescription>
            {invoices.length} facturen gevonden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveDataTable<typeof invoices[0]>
            rows={invoices}
            getRowKey={(i) => i.id}
            isLoading={isLoading}
            cardModeBreakpoint="compact"
            emptyState={
              <div className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Geen facturen gevonden</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {search || statusFilter !== 'all' || peppolPendingOnly
                    ? 'Probeer andere zoekfilters'
                    : 'Facturen worden automatisch aangemaakt na betaling'}
                </p>
              </div>
            }
            columns={[
              {
                id: 'number',
                header: 'Factuurnummer',
                 render: (invoice) => (
                   <div className="flex items-center gap-2">
                     <span className="font-medium whitespace-nowrap">{invoice.invoice_number}</span>
                     <OdooSyncBadge row={odooSync?.invoices.get(invoice.id)} />
                   </div>
                 ),
              },
              {
                id: 'customer',
                header: 'Klant',
                render: (invoice) => {
                  const c = getCustomerDisplay(invoice);
                  return (
                    <div className="max-w-[200px]">
                      <div className="font-medium truncate">{c.name}</div>
                      {c.email && <div className="text-xs text-muted-foreground truncate">{c.email}</div>}
                    </div>
                  );
                },
              },
              {
                id: 'order',
                header: 'Order',
                priority: 'lg',
                render: (invoice) => invoice.orders ? (
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/orders/${invoice.order_id}`); }}
                  >
                    {invoice.orders.order_number}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                ) : <span className="text-muted-foreground">-</span>,
              },
              {
                id: 'source',
                header: 'Bron',
                priority: 'xl',
                render: (invoice) => (
                  <OrderMarketplaceBadge
                    source={invoice.orders?.marketplace_source || (invoice.order_id ? null : 'manual')}
                  />
                ),
              },
              {
                id: 'date',
                header: 'Datum',
                priority: 'md',
                render: (invoice) => (
                  <span className="whitespace-nowrap">
                    {format(new Date(invoice.created_at), 'd MMM yyyy', { locale: nl })}
                  </span>
                ),
              },
              {
                id: 'amount',
                header: 'Bedrag',
                align: 'right',
                render: (invoice) => (
                  <span className="whitespace-nowrap font-medium">{formatCurrency(invoice.total)}</span>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                render: (invoice) => (
                  <div className="flex flex-wrap items-center gap-1">
                    <InvoiceStatusBadge status={invoice.status} />
                    {getPeppolStatusBadge(invoice as any)}
                  </div>
                ),
              },
              {
                id: 'actions',
                header: '',
                align: 'right',
                width: '60px',
                render: (invoice) => {
                  const invoiceAny = invoice as any;
                  const actions: ActionItem[] = [];
                  if (invoiceAny.pdf_path) {
                    actions.push({ label: 'Download PDF', icon: <Download className="h-4 w-4" />, onClick: () => openDocument('invoice', invoice.id, 'pdf') });
                  }
                  if (invoiceAny.ubl_path) {
                    actions.push({ label: t('peppol.download_ubl'), icon: <FileCode className="h-4 w-4" />, onClick: () => openDocument('invoice', invoice.id, 'ubl') });
                  }
                  if (canWriteInvoices && ['pending','manual_action'].includes(invoiceAny.peppol_status)) {
                    actions.push({ label: t('peppol.mark_as_sent'), icon: <CheckCircle className="h-4 w-4" />, onClick: () => markPeppolSent.mutate(invoice.id) });
                  }
                  if (canWriteInvoices) {
                    actions.push({ label: 'Opnieuw versturen', icon: <Mail className="h-4 w-4" />, onClick: () => resendInvoice.mutate(invoice.id) });
                  }
                  
                  if (canWriteInvoices && invoice.status === 'paid') {
                    actions.push({
                      separator: true,
                      render: () => (
                        <RefundInvoiceButton
                          amountLabel={formatCurrency(Number(invoice.total || 0))}
                          hasRefund={!!invoiceAny.metadata?.stripe_refund_id}
                          hasCreditNote={invoiceIdsWithCreditNote.has(invoice.id)}
                          onConfirm={() => refundInvoice.mutateAsync(invoice.id)}
                        />
                      ),
                    });
                  }
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <ActionsMenu items={actions} />
                      <CreateCreditNoteFromInvoiceButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.invoice_number}
                        onSuccess={() => refetch()}
                        compact
                      />
                    </div>
                  );
                },
              },
            ] satisfies ColumnDef<typeof invoices[0]>[]}
            mobileCardRender={(invoice) => {
              const customer = getCustomerDisplay(invoice);
              const invoiceAny = invoice as any;
              const actions: ActionItem[] = [];
              if (invoiceAny.pdf_path) actions.push({ label: 'Download PDF', icon: <Download className="h-4 w-4" />, onClick: () => openDocument('invoice', invoice.id, 'pdf') });
              if (invoiceAny.ubl_path) actions.push({ label: t('peppol.download_ubl'), icon: <FileCode className="h-4 w-4" />, onClick: () => openDocument('invoice', invoice.id, 'ubl') });
              if (canWriteInvoices && ['pending','manual_action'].includes(invoiceAny.peppol_status)) actions.push({ label: t('peppol.mark_as_sent'), icon: <CheckCircle className="h-4 w-4" />, onClick: () => markPeppolSent.mutate(invoice.id) });
              if (canWriteInvoices) actions.push({ label: 'Opnieuw versturen', icon: <Mail className="h-4 w-4" />, onClick: () => resendInvoice.mutate(invoice.id) });
              if (canWriteInvoices && invoice.status === 'paid') {
                actions.push({
                  separator: true,
                  render: () => (
                    <RefundInvoiceButton
                      amountLabel={formatCurrency(Number(invoice.total || 0))}
                      hasRefund={!!invoiceAny.metadata?.stripe_refund_id}
                      hasCreditNote={invoiceIdsWithCreditNote.has(invoice.id)}
                      onConfirm={() => refundInvoice.mutateAsync(invoice.id)}
                    />
                  ),
                });
              }
              return (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{invoice.invoice_number}</div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">{customer.name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium whitespace-nowrap">{formatCurrency(invoice.total)}</span>
                      <ActionsMenu items={actions} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <InvoiceStatusBadge status={invoice.status} />
                      {getPeppolStatusBadge(invoiceAny)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(invoice.created_at), 'd MMM yyyy', { locale: nl })}
                      </span>
                    </div>
                    <CreateCreditNoteFromInvoiceButton
                      invoiceId={invoice.id}
                      invoiceNumber={invoice.invoice_number}
                      onSuccess={() => refetch()}
                      compact
                    />
                  </div>
                </div>
              );
            }}
          />
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="creditnotes">
          <CreditNotesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
