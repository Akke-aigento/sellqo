import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
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

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Platform Facturen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices && invoices.length > 0 ? (
          <Table>
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
                    €{(invoice.amount / 100).toFixed(2)}
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
        ) : (
          <p className="text-muted-foreground text-sm py-8 text-center">
            Geen facturen gevonden voor deze tenant
          </p>
        )}
      </CardContent>
    </Card>
  );
}
