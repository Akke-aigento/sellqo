import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Send, Link2, Copy, Trash2, Loader2, User, Calendar, Clock, Mail, Phone, ExternalLink, MessageSquare, ShoppingCart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { QuoteStatusBadge } from '@/components/admin/QuoteStatusBadge';
import { CustomerMessageDialog } from '@/components/admin/CustomerMessageDialog';
import { MessageHistoryPanel } from '@/components/admin/MessageHistoryPanel';
import { useQuote, useQuotes } from '@/hooks/useQuotes';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function QuoteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const { quote, isLoading } = useQuote(id);
  const { sendQuote, generatePaymentLink, deleteQuote, convertToOrder } = useQuotes();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Offerte laden...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium">Offerte niet gevonden</p>
        <Button variant="link" onClick={() => navigate('/admin/orders/quotes')}>
          Terug naar offertes
        </Button>
      </div>
    );
  }

  const handleSend = async () => {
    setIsSending(true);
    try {
      await sendQuote.mutateAsync(quote.id);
    } finally {
      setIsSending(false);
    }
  };

  const handleGeneratePaymentLink = async () => {
    setIsGeneratingLink(true);
    try {
      await generatePaymentLink.mutateAsync(quote.id);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (quote.payment_link) {
      navigator.clipboard.writeText(quote.payment_link);
      toast({ title: 'Link gekopieerd naar klembord' });
    }
  };

  const handleDelete = async () => {
    await deleteQuote.mutateAsync(quote.id);
    navigate('/admin/orders/quotes');
  };

  const handleConvertToOrder = async () => {
    setIsConverting(true);
    try {
      const order = await convertToOrder.mutateAsync(quote.id);
      navigate(`/admin/orders/${order.id}`);
    } finally {
      setIsConverting(false);
      setShowConvertDialog(false);
    }
  };

  const getCustomerName = () => {
    if (!quote.customer) return '-';
    const name = `${quote.customer.first_name || ''} ${quote.customer.last_name || ''}`.trim();
    return name || quote.customer.email;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders/quotes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{quote.quote_number}</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <p className="text-muted-foreground">
              Aangemaakt op {format(new Date(quote.created_at), 'd MMMM yyyy', { locale: nl })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quote.status === 'draft' && (
            <>
              <Button variant="outline" onClick={() => navigate(`/admin/orders/quotes/${quote.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Bewerken
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Versturen
              </Button>
            </>
          )}
          {quote.status === 'sent' && !quote.payment_link && (
            <Button onClick={handleGeneratePaymentLink} disabled={isGeneratingLink}>
              {isGeneratingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Link2 className="mr-2 h-4 w-4" />
              Betalingslink genereren
            </Button>
          )}
          {quote.payment_link && (
            <Button variant="outline" onClick={handleCopyPaymentLink}>
              <Copy className="mr-2 h-4 w-4" />
              Kopieer betalingslink
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 sm:px-6">
              <div className="min-w-[550px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="text-right">Prijs</TableHead>
                    <TableHead className="text-center">Aantal</TableHead>
                    <TableHead className="text-right">Korting</TableHead>
                    <TableHead className="text-right">Totaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.quote_items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.product_name}</p>
                        {item.product_sku && (
                          <p className="text-xs text-muted-foreground">SKU: {item.product_sku}</p>
                        )}
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">€{Number(item.unit_price).toFixed(2)}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {Number(item.discount_percent) > 0 ? `${item.discount_percent}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        €{Number(item.total_price).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <div className="border-t mt-4 pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotaal</span>
                      <span>€{Number(quote.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">BTW</span>
                      <span>€{Number(quote.tax_amount).toFixed(2)}</span>
                    </div>
                    {Number(quote.discount_amount) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Korting</span>
                        <span>-€{Number(quote.discount_amount).toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-medium text-lg">
                      <span>Totaal</span>
                      <span>€{Number(quote.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {(quote.notes || quote.internal_notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Notities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quote.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Voor klant</p>
                    <p className="text-sm">{quote.notes}</p>
                  </div>
                )}
                {quote.internal_notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Intern</p>
                    <p className="text-sm">{quote.internal_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Klant</CardTitle>
            </CardHeader>
            <CardContent>
              {quote.customer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{getCustomerName()}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{quote.customer.email}</span>
                    </div>
                    {quote.customer.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{quote.customer.phone}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowMessageDialog(true)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Email klant
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Geen klant gekoppeld</p>
              )}
            </CardContent>
          </Card>

          {/* Message History */}
          {quote.id && (
            <MessageHistoryPanel 
              entityType="quote" 
              entityId={quote.id} 
              compact 
              maxItems={3} 
            />
          )}

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Geldig tot
                </span>
                <span>
                  {quote.valid_until 
                    ? format(new Date(quote.valid_until), 'd MMM yyyy', { locale: nl })
                    : '-'}
                </span>
              </div>
              {quote.sent_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Verstuurd
                  </span>
                  <span>{format(new Date(quote.sent_at), 'd MMM yyyy HH:mm', { locale: nl })}</span>
                </div>
              )}
              {quote.accepted_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Geaccepteerd
                  </span>
                  <span>{format(new Date(quote.accepted_at), 'd MMM yyyy HH:mm', { locale: nl })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Link */}
          {quote.payment_link && (
            <Card>
              <CardHeader>
                <CardTitle>Betalingslink</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleCopyPaymentLink}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Kopiëren
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(quote.payment_link!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Convert to order button */}
              {(quote.status === 'draft' || quote.status === 'accepted' || quote.status === 'sent') && !quote.converted_order_id && (
                <Button 
                  className="w-full justify-start"
                  onClick={() => setShowConvertDialog(true)}
                  disabled={isConverting}
                >
                  {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  Omzetten naar bestelling
                </Button>
              )}
              {/* Link to converted order */}
              {quote.converted_order_id && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/admin/orders/${quote.converted_order_id}`)}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Bekijk bestelling
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offerte verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je offerte {quote.quote_number} wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Order Dialog */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Omzetten naar bestelling</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je offerte {quote.quote_number} wilt omzetten naar een bestelling?
              Er wordt een nieuwe bestelling aangemaakt en de offerte-status wordt gewijzigd naar "Omgezet".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConverting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToOrder} disabled={isConverting}>
              {isConverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Omzetten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Message Dialog */}
      {quote.customer && (
        <CustomerMessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          customerEmail={quote.customer.email}
          customerName={getCustomerName()}
          contextType="quote"
          quoteId={quote.id}
          customerId={quote.customer.id}
          quoteNumber={quote.quote_number}
        />
      )}
    </div>
  );
}
