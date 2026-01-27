import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CreditCard, 
  TrendingUp, 
  Clock, 
  ArrowDownToLine, 
  AlertCircle,
  Banknote,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { useMerchantTransactions, useMerchantPayouts, useBankTransferStats } from '@/hooks/useMerchantPayments';
import { useTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { BankReconciliationUpload } from '@/components/admin/BankReconciliationUpload';

function formatCurrency(amount: number, currency: string = 'eur') {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(timestamp: number) {
  return format(new Date(timestamp * 1000), 'dd MMM yyyy', { locale: nl });
}

function getTransactionTypeBadge(type: string) {
  const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    charge: { label: 'Betaling', variant: 'default' },
    payment: { label: 'Betaling', variant: 'default' },
    payout: { label: 'Uitbetaling', variant: 'secondary' },
    refund: { label: 'Terugbetaling', variant: 'destructive' },
    transfer: { label: 'Transfer', variant: 'outline' },
    application_fee: { label: 'Platform fee', variant: 'outline' },
  };
  
  const config = variants[type] || { label: type, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPayoutStatusBadge(status: string) {
  const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    paid: { label: 'Uitbetaald', variant: 'default' },
    pending: { label: 'In behandeling', variant: 'secondary' },
    in_transit: { label: 'Onderweg', variant: 'secondary' },
    canceled: { label: 'Geannuleerd', variant: 'destructive' },
    failed: { label: 'Mislukt', variant: 'destructive' },
  };
  
  const config = variants[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function PaymentsPage() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { 
    data: transactionsData, 
    isLoading: transactionsLoading, 
    error: transactionsError,
    refetch: refetchTransactions,
  } = useMerchantTransactions();
  
  const { 
    data: payoutsData, 
    isLoading: payoutsLoading, 
    error: payoutsError,
    refetch: refetchPayouts,
  } = useMerchantPayouts();
  
  const { data: bankStats } = useBankTransferStats(currentTenant?.id);

  const hasStripeAccount = !!currentTenant?.stripe_account_id;
  const isLoading = transactionsLoading || payoutsLoading;

  // Calculate MTD stats from transactions
  const mtdRevenue = transactionsData?.transactions
    ?.filter(tx => tx.type === 'charge' || tx.type === 'payment')
    .reduce((sum, tx) => sum + tx.amount, 0) || 0;
  
  const mtdFees = transactionsData?.transactions
    ?.filter(tx => tx.type === 'charge' || tx.type === 'payment')
    .reduce((sum, tx) => sum + tx.fee, 0) || 0;

  const handleRefresh = () => {
    refetchTransactions();
    refetchPayouts();
  };

  if (!hasStripeAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Betalingen</h1>
          <p className="text-muted-foreground">Bekijk je transacties en uitbetalingen</p>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Geen betalingsaccount gekoppeld</AlertTitle>
          <AlertDescription>
            Koppel eerst een Stripe account via Instellingen → Betalingsmethoden om hier je transacties te zien.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Betalingen</h1>
          <p className="text-muted-foreground">Bekijk je transacties en uitbetalingen</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Vernieuwen
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Beschikbaar Saldo</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(transactionsData?.balance?.available || 0, transactionsData?.balance?.currency)}
                </div>
                <p className="text-xs text-muted-foreground">Klaar voor uitbetaling</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Behandeling</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(transactionsData?.balance?.pending || 0, transactionsData?.balance?.currency)}
                </div>
                <p className="text-xs text-muted-foreground">Wordt verwerkt</p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stripe Omzet (MTD)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(mtdRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  -{formatCurrency(mtdFees)} fees
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bankoverschrijvingen</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(bankStats?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {bankStats?.count || 0} betalingen deze maand
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Transacties</TabsTrigger>
          <TabsTrigger value="payouts">Uitbetalingen</TabsTrigger>
          <TabsTrigger value="reconciliation">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bank Reconciliatie
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recente Transacties</CardTitle>
              <CardDescription>Al je Stripe transacties van de afgelopen periode</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Fout bij laden</AlertTitle>
                  <AlertDescription>{String(transactionsError)}</AlertDescription>
                </Alert>
              ) : transactionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : transactionsData?.transactions?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nog geen transacties</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Omschrijving</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsData?.transactions?.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{formatDate(tx.created)}</TableCell>
                        <TableCell>{getTransactionTypeBadge(tx.type)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {tx.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {tx.fee > 0 ? `-${formatCurrency(tx.fee, tx.currency)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(tx.net, tx.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Uitbetalingen</CardTitle>
              <CardDescription>
                {payoutsData?.schedule ? (
                  <>
                    Schema: {payoutsData.schedule.interval === 'daily' ? 'Dagelijks' : 
                            payoutsData.schedule.interval === 'weekly' ? 'Wekelijks' : 
                            payoutsData.schedule.interval === 'monthly' ? 'Maandelijks' : 
                            payoutsData.schedule.interval}
                    {payoutsData.schedule.delay_days > 0 && ` (${payoutsData.schedule.delay_days} dagen vertraging)`}
                  </>
                ) : (
                  'Overzicht van al je uitbetalingen naar je bankrekening'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payoutsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Fout bij laden</AlertTitle>
                  <AlertDescription>{String(payoutsError)}</AlertDescription>
                </Alert>
              ) : payoutsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : payoutsData?.payouts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowDownToLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nog geen uitbetalingen</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aankomstdatum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Methode</TableHead>
                      <TableHead className="text-right">Bedrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutsData?.payouts?.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">
                          {formatDate(payout.arrival_date)}
                        </TableCell>
                        <TableCell>{getPayoutStatusBadge(payout.status)}</TableCell>
                        <TableCell className="capitalize">{payout.method}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payout.amount, payout.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <BankReconciliationUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}
