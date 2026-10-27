import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useTenantBillingFigures } from '@/hooks/usePlatformBillingOverview';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TenantInvoicesTabProps {
  tenantId: string;
}

export function TenantInvoicesTab({ tenantId }: TenantInvoicesTabProps) {
  const { useTenantInvoices } = usePlatformAdmin();
  const { data: invoices, isLoading } = useTenantInvoices(tenantId);
  // PLATFORM-FIGURES-1: de echte SellQo-facturen en creditnota's van deze tenant.
  const { figures, documents, isLoading: figuresLoading, error: figuresError } = useTenantBillingFigures(tenantId);

  if (isLoading || figuresLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const eur = (n: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const docLabel: Record<string, string> = {
    paid: 'Betaald', sent: 'Open', unpaid: 'Onbetaald', processing: 'In verwerking', cancelled: 'Geannuleerd', draft: 'Concept',
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Betaald</Badge>;
      case 'open':
        return <Badge variant="secondary">Open</Badge>;
      case 'draft':
        return <Badge variant="outline">Concept</Badge>;
      case 'void':
        return <Badge variant="destructive">Geannuleerd</Badge>;
      case 'uncollectible':
        return <Badge variant="destructive">Oninbaar</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Betalingen aan SellQo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {figuresError ? (
          <p className="text-sm text-destructive">Cijfers konden niet geladen worden: {(figuresError as Error).message}</p>
        ) : figures && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Betaald (incl. btw)</p>
              <p className="text-xl font-bold">{eur(figures.paid_gross)}</p>
              <p className="text-xs text-muted-foreground">{eur(figures.paid_net)} excl. btw · {figures.paid_invoices} factuur/facturen</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Openstaand (incl. btw)</p>
              <p className={`text-xl font-bold ${figures.open_gross > 0 ? 'text-destructive' : ''}`}>{eur(figures.open_gross)}</p>
              {figures.open_due_date && (
                <p className="text-xs text-muted-foreground">
                  vervalt {format(new Date(figures.open_due_date), 'dd MMM yyyy', { locale: nl })}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Abonnement per maand (excl. btw)</p>
              <p className="text-xl font-bold">{eur(figures.mrr_net)}</p>
              {figures.category !== 'client' && (
                <p className="text-xs text-muted-foreground">telt niet mee in de platformcijfers</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Laatste betaling</p>
              <p className="text-xl font-bold">
                {figures.last_paid_at ? format(new Date(figures.last_paid_at), 'dd MMM yyyy', { locale: nl }) : '—'}
              </p>
              {figures.credited_gross > 0 && (
                <p className="text-xs text-muted-foreground">gecrediteerd: {eur(figures.credited_gross)}</p>
              )}
            </div>
          </div>
        )}

        {documents.length > 0 ? (
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Excl. btw</TableHead>
                <TableHead className="text-right">Incl. btw</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={`${doc.kind}-${doc.id}`}>
                  <TableCell className="font-mono">{doc.number || '—'}</TableCell>
                  <TableCell>{format(new Date(doc.doc_date), 'dd MMM yyyy', { locale: nl })}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(doc.subtotal)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{eur(doc.total)}</TableCell>
                  <TableCell>
                    {doc.kind === 'credit_note'
                      ? <Badge variant="outline">Creditnota</Badge>
                      : doc.status === 'paid'
                        ? <Badge className="bg-green-100 text-green-800">Betaald</Badge>
                        : <Badge variant={doc.status === 'cancelled' ? 'outline' : 'secondary'}>{docLabel[doc.status] || doc.status}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-4 text-center">
            Nog geen SellQo-facturen voor deze tenant
          </p>
        )}
      </CardContent>
    </Card>

    {invoices && invoices.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historisch archief (oude Stripe Billing, bankbetalingen, AI-credits)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Factuurnummer</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Bedrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono">
                    {invoice.invoice_number || invoice.stripe_invoice_id || '-'}
                  </TableCell>
                  <TableCell>
                    {invoice.invoice_date
                      ? format(new Date(invoice.invoice_date), 'dd MMM yyyy', { locale: nl })
                      : format(new Date(invoice.created_at), 'dd MMM yyyy', { locale: nl })}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {eur(Number(invoice.amount))}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {invoice.invoice_pdf_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <a
                                href={invoice.invoice_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download PDF</TooltipContent>
                        </Tooltip>
                      )}
                      {invoice.hosted_invoice_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild>
                              <a
                                href={invoice.hosted_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {invoice.status === 'paid' ? 'Bekijk factuur' : 'Betaal factuur'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
    )}
    </div>
  );
}
