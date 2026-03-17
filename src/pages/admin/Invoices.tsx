import { useState } from 'react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { nl } from 'date-fns/locale';
import { FileText, Download, Mail, Search, ExternalLink, FileCode, CheckCircle, Clock, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '@/hooks/useInvoices';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceStatusBadge } from '@/components/admin/InvoiceStatusBadge';
import { ManualInvoiceDialog } from '@/components/admin/ManualInvoiceDialog';
import { OrderMarketplaceBadge } from '@/components/admin/marketplace/OrderMarketplaceBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import type { InvoiceStatus } from '@/types/invoice';

export default function InvoicesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [peppolPendingOnly, setPeppolPendingOnly] = useState(false);

  const { invoices, isLoading, resendInvoice, markPeppolSent, refetch } = useInvoices({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    peppolPending: peppolPendingOnly || undefined,
  });

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
    
    if (invoice.peppol_status === 'sent') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Peppol verzonden
        </Badge>
      );
    }
    
    return null;
  };

  // Count peppol pending invoices
  const peppolPendingCount = invoices.filter(inv => (inv as any).peppol_status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturen</h1>
          <p className="text-muted-foreground">
            Beheer en bekijk alle facturen
          </p>
        </div>
        <ManualInvoiceDialog onSuccess={() => refetch()} />
      </div>

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
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Geen facturen gevonden</h3>
              <p className="text-muted-foreground mt-1">
                {search || statusFilter !== 'all' || peppolPendingOnly
                  ? 'Probeer andere zoekfilters'
                  : 'Facturen worden automatisch aangemaakt na betaling'}
              </p>
            </div>
          ) : (
            isMobile ? (
              <div className="space-y-2 px-3 sm:px-0">
                {invoices.map((invoice) => {
                  const customer = getCustomerDisplay(invoice);
                  return (
                    <div
                      key={invoice.id}
                      className="rounded-lg border bg-card p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{invoice.invoice_number}</span>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {customer.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(invoice.created_at), 'd MMM yyyy', { locale: nl })}
                        </span>
                        <span className="font-semibold text-sm">{formatCurrency(invoice.total)}</span>
                      </div>
                      {(invoice.pdf_url || invoice.ubl_url) && (
                        <div className="flex items-center gap-1 pt-1 border-t">
                          {invoice.pdf_url && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(invoice.pdf_url!, '_blank')}>
                              <Download className="h-3 w-3 mr-1" /> PDF
                            </Button>
                          )}
                          {invoice.ubl_url && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => window.open(invoice.ubl_url!, '_blank')}>
                              <FileCode className="h-3 w-3 mr-1" /> UBL
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
            <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factuurnummer</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead className="hidden md:table-cell">Order</TableHead>
                  <TableHead className="hidden lg:table-cell">Bron</TableHead>
                  <TableHead className="hidden sm:table-cell">Datum</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Peppol</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const customer = getCustomerDisplay(invoice);
                  const invoiceAny = invoice as any;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div>
                          <div className="font-medium truncate">{customer.name}</div>
                          {customer.email && (
                            <div className="text-sm text-muted-foreground truncate">{customer.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {invoice.orders ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal"
                            onClick={() => navigate(`/admin/orders/${invoice.order_id}`)}
                          >
                            {invoice.orders.order_number}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <OrderMarketplaceBadge
                          source={invoice.orders?.marketplace_source || (invoice.order_id ? null : 'manual')} 
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {format(new Date(invoice.created_at), 'd MMM yyyy', { locale: nl })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getPeppolStatusBadge(invoiceAny)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {invoice.pdf_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(invoice.pdf_url!, '_blank')}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download PDF</TooltipContent>
                            </Tooltip>
                          )}
                          {invoice.ubl_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(invoice.ubl_url!, '_blank')}
                                >
                                  <FileCode className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('peppol.download_ubl')}</TooltipContent>
                            </Tooltip>
                          )}
                          {invoiceAny.peppol_status === 'pending' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => markPeppolSent.mutate(invoice.id)}
                                  disabled={markPeppolSent.isPending}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('peppol.mark_as_sent')}</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => resendInvoice.mutate(invoice.id)}
                                disabled={resendInvoice.isPending}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Opnieuw versturen</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
