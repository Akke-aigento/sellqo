import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Eye, Copy, Send, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuoteStatusBadge } from '@/components/admin/QuoteStatusBadge';
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveDataTable, type ColumnDef } from '@/components/ui/responsive-data-table';
import { ActionsMenu, type ActionItem } from '@/components/ui/actions-menu';
import { useQuotes } from '@/hooks/useQuotes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { QuoteStatus, Quote } from '@/types/quote';

export default function QuotesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [deleteQuote, setDeleteQuote] = useState<Quote | null>(null);

  const { quotes, isLoading, deleteQuote: deleteQuoteMutation, sendQuote } = useQuotes({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const handleDelete = async () => {
    if (deleteQuote) {
      await deleteQuoteMutation.mutateAsync(deleteQuote.id);
      setDeleteQuote(null);
    }
  };

  const handleSend = async (quote: Quote) => {
    await sendQuote.mutateAsync(quote.id);
  };

  const getCustomerName = (quote: Quote) => {
    if (!quote.customer) return '-';
    const name = `${quote.customer.first_name || ''} ${quote.customer.last_name || ''}`.trim();
    return name || quote.customer.email;
  };

  const buildActions = (quote: Quote): ActionItem[] => {
    const items: ActionItem[] = [
      { label: 'Bekijken', icon: <Eye className="h-4 w-4" />, onClick: () => navigate(`/admin/orders/quotes/${quote.id}`) },
      { label: 'Kopiëren', icon: <Copy className="h-4 w-4" />, onClick: () => { /* TODO */ } },
    ];
    if (quote.status === 'draft') {
      items.push({ label: 'Versturen', icon: <Send className="h-4 w-4" />, onClick: () => handleSend(quote) });
    }
    items.push({
      label: 'Verwijderen',
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      separator: true,
      onClick: () => setDeleteQuote(quote),
    });
    return items;
  };

  const columns: ColumnDef<Quote>[] = [
    { id: 'number', header: 'Nummer', render: (q) => <span className="font-medium">{q.quote_number}</span> },
    { id: 'customer', header: 'Klant', render: (q) => <span className="block max-w-[180px] truncate">{getCustomerName(q)}</span> },
    { id: 'status', header: 'Status', render: (q) => <QuoteStatusBadge status={q.status} /> },
    { id: 'valid_until', header: 'Geldig tot', priority: 'md', render: (q) => q.valid_until ? format(new Date(q.valid_until), 'd MMM yyyy', { locale: nl }) : '-' },
    { id: 'total', header: 'Totaal', align: 'right', render: (q) => <span className="font-medium">€{Number(q.total).toFixed(2)}</span> },
    { id: 'created_at', header: 'Datum', align: 'right', priority: 'md', render: (q) => <span className="text-muted-foreground">{format(new Date(q.created_at), 'd MMM yyyy', { locale: nl })}</span> },
    { id: 'actions', header: '', align: 'right', width: '50px', render: (q) => <ActionsMenu items={buildActions(q)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offertes"
        description="Maak en beheer offertes voor je klanten"
        actions={
          <Button onClick={() => navigate('/admin/orders/quotes/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe offerte
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op offertenummer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as QuoteStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="draft">Concept</SelectItem>
                <SelectItem value="sent">Verstuurd</SelectItem>
                <SelectItem value="accepted">Geaccepteerd</SelectItem>
                <SelectItem value="declined">Afgewezen</SelectItem>
                <SelectItem value="expired">Verlopen</SelectItem>
                <SelectItem value="converted">Omgezet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Offertes laden...</p>
            </div>
          ) : (
            <ResponsiveDataTable
              columns={columns}
              rows={quotes}
              getRowKey={(q) => q.id}
              onRowClick={(q) => navigate(`/admin/orders/quotes/${q.id}`)}
              cardModeBreakpoint="compact"
              emptyState={
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">Geen offertes gevonden</p>
                  <p className="text-sm">
                    {search || statusFilter !== 'all'
                      ? 'Probeer andere filters'
                      : 'Maak je eerste offerte aan'}
                  </p>
                </div>
              }
              mobileCardRender={(quote) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{quote.quote_number}</div>
                      <div className="text-sm text-muted-foreground truncate">{getCustomerName(quote)}</div>
                    </div>
                    <ActionsMenu items={buildActions(quote)} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <QuoteStatusBadge status={quote.status} />
                    <span className="font-medium">€{Number(quote.total).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {quote.valid_until ? `Geldig tot ${format(new Date(quote.valid_until), 'd MMM yyyy', { locale: nl })}` : format(new Date(quote.created_at), 'd MMM yyyy', { locale: nl })}
                  </div>
                </div>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteQuote} onOpenChange={() => setDeleteQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offerte verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je offerte {deleteQuote?.quote_number} wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
