import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, MoreHorizontal, Eye, Copy, Send, Trash2, Loader2 } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Offertes</h1>
          <p className="text-muted-foreground">
            Maak en beheer offertes voor je klanten
          </p>
        </div>
        <Button onClick={() => navigate('/admin/orders/quotes/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe offerte
        </Button>
      </div>

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
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">Geen offertes gevonden</p>
              <p className="text-sm">
                {search || statusFilter !== 'all' 
                  ? 'Probeer andere filters' 
                  : 'Maak je eerste offerte aan'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button 
                  className="mt-4" 
                  onClick={() => navigate('/admin/orders/quotes/new')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuwe offerte
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <div className="min-w-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Geldig tot</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Datum</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow 
                    key={quote.id} 
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/orders/quotes/${quote.id}`)}
                  >
                    <TableCell className="font-medium">{quote.quote_number}</TableCell>
                    <TableCell>{getCustomerName(quote)}</TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {quote.valid_until 
                        ? format(new Date(quote.valid_until), 'd MMM yyyy', { locale: nl })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{Number(quote.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-muted-foreground">
                      {format(new Date(quote.created_at), 'd MMM yyyy', { locale: nl })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/orders/quotes/${quote.id}`);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Bekijken
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement copy
                          }}>
                            <Copy className="mr-2 h-4 w-4" />
                            Kopiëren
                          </DropdownMenuItem>
                          {quote.status === 'draft' && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleSend(quote);
                            }}>
                              <Send className="mr-2 h-4 w-4" />
                              Versturen
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteQuote(quote);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </div>
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
