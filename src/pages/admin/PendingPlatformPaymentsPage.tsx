import { useState } from 'react';
import { useIsCompact } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Banknote, 
  Copy, 
  Search,
  Loader2,
  AlertTriangle,
  Sparkles,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PendingPayment {
  id: string;
  tenant_id: string;
  ogm_reference: string;
  amount: number;
  currency: string;
  payment_type: 'subscription' | 'addon' | 'ai_credits';
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  credits_amount: number | null;
  package_id: string | null;
  addon_type: string | null;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  notes: string | null;
  tenants?: {
    id: string;
    name: string;
    slug: string;
  };
}

export function PendingPlatformPaymentsPage() {
  const queryClient = useQueryClient();
  const isCompact = useIsCompact();
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<PendingPayment | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_platform_payments')
        .select(`
          *,
          tenants:tenant_id (
            id,
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PendingPayment[];
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase.functions.invoke('confirm-platform-bank-payment', {
        body: { paymentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      toast.success('Betaling bevestigd', {
        description: 'De credits/module zijn toegevoegd aan de tenant.',
      });
      setConfirmDialog(null);
    },
    onError: (error) => {
      toast.error('Bevestiging mislukt', {
        description: error instanceof Error ? error.message : 'Probeer het opnieuw',
      });
    },
  });

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    setIsConfirming(true);
    await confirmMutation.mutateAsync(confirmDialog.id);
    setIsConfirming(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Gekopieerd');
  };

  const filteredPayments = payments.filter((payment) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      payment.ogm_reference.toLowerCase().includes(query) ||
      payment.tenants?.name?.toLowerCase().includes(query) ||
      payment.tenants?.slug?.toLowerCase().includes(query)
    );
  });

  const pendingPayments = filteredPayments.filter(p => p.status === 'pending');
  const processedPayments = filteredPayments.filter(p => p.status !== 'pending');

  const getPaymentTypeIcon = (type: string) => {
    switch (type) {
      case 'ai_credits':
        return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'addon':
        return <Package className="h-4 w-4 text-amber-500" />;
      default:
        return <Banknote className="h-4 w-4 text-green-500" />;
    }
  };

  const getPaymentTypeLabel = (payment: PendingPayment) => {
    if (payment.payment_type === 'ai_credits') {
      return `${payment.credits_amount} AI Credits`;
    }
    if (payment.payment_type === 'addon') {
      return `${payment.addon_type?.toUpperCase()} Add-on`;
    }
    return 'Subscription';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Wachtend</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Bevestigd</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" />Verlopen</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><XCircle className="h-3 w-3 mr-1" />Geannuleerd</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-green-600" />
            Platform Bankoverschrijvingen
          </h1>
          <p className="text-muted-foreground">
            Beheer openstaande bankbetalingen voor AI credits en add-ons
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op OGM of tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {/* Pending Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Wachtende Betalingen
            {pendingPayments.length > 0 && (
              <Badge className="ml-2">{pendingPayments.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Betalingen die wachten op bevestiging na bankoverschrijving
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {pendingPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Geen openstaande betalingen</p>
            </div>
          ) : (
            <div className="min-w-[700px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead className="hidden md:table-cell">OGM Referentie</TableHead>
                  <TableHead className="hidden sm:table-cell">Aangemaakt</TableHead>
                  <TableHead className="hidden sm:table-cell">Verloopt</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.tenants?.name || 'Onbekend'}</p>
                        <p className="text-xs text-muted-foreground">{payment.tenants?.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentTypeIcon(payment.payment_type)}
                        <span className="text-sm">{getPaymentTypeLabel(payment)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {payment.ogm_reference}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(payment.ogm_reference)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true, locale: nl })}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {format(new Date(payment.expires_at), 'd MMM', { locale: nl })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setConfirmDialog(payment)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Bevestigen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Payments History */}
      {processedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Geschiedenis</CardTitle>
            <CardDescription>Eerder verwerkte betalingen</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 sm:px-6">
            <div className="min-w-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead className="hidden md:table-cell">OGM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Verwerkt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedPayments.slice(0, 20).map((payment) => (
                  <TableRow key={payment.id} className="opacity-70">
                    <TableCell>{payment.tenants?.name || 'Onbekend'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentTypeIcon(payment.payment_type)}
                        <span className="text-sm">{getPaymentTypeLabel(payment)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs">{payment.ogm_reference}</code>
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {payment.confirmed_at 
                        ? format(new Date(payment.confirmed_at), 'd MMM yyyy', { locale: nl })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Betaling Bevestigen
            </DialogTitle>
            <DialogDescription>
              Bevestig dat je de bankoverschrijving hebt ontvangen
            </DialogDescription>
          </DialogHeader>

          {confirmDialog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tenant</p>
                  <p className="font-medium">{confirmDialog.tenants?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bedrag</p>
                  <p className="font-medium">{formatCurrency(confirmDialog.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{getPaymentTypeLabel(confirmDialog)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">OGM Referentie</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {confirmDialog.ogm_reference}
                  </code>
                </div>
              </div>

              <Separator />

              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-sm text-green-700 dark:text-green-300">
                <p className="font-medium">Na bevestiging:</p>
                {confirmDialog.payment_type === 'ai_credits' ? (
                  <p>{confirmDialog.credits_amount} credits worden toegevoegd aan de tenant.</p>
                ) : (
                  <p>De {confirmDialog.addon_type} module wordt geactiveerd voor de tenant.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={isConfirming}>
              Annuleren
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={isConfirming}
              className="bg-green-600 hover:bg-green-700"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bevestigen...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Betaling Bevestigen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
