import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatformBilling } from '@/hooks/usePlatformBilling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  Users, 
  CreditCard, 
  AlertTriangle,
  Gift,
  Mail,
  ExternalLink,
  Search,
  Percent
} from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

export default function PlatformBilling() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'nl' ? nl : enUS;
  
  const { 
    subscriptions, 
    metrics, 
    allInvoices, 
    atRiskTenants,
    isLoading,
    giftMonth 
  } = usePlatformBilling();

  const [searchTerm, setSearchTerm] = useState('');
  const [giftMonthDialog, setGiftMonthDialog] = useState<{ 
    open: boolean; 
    tenantId?: string; 
    tenantName?: string 
  }>({ open: false });
  const [giftMonths, setGiftMonths] = useState(1);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const filteredSubscriptions = subscriptions.filter(sub => 
    sub.tenants?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.tenants?.owner_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: 'default',
      trialing: 'secondary',
      past_due: 'destructive',
      canceled: 'outline',
      unpaid: 'destructive',
    };
    const labels: Record<string, string> = {
      active: 'Actief',
      trialing: 'Trial',
      past_due: 'Achterstallig',
      canceled: 'Geannuleerd',
      unpaid: 'Onbetaald',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const handleGiftMonth = () => {
    if (giftMonthDialog.tenantId) {
      giftMonth.mutate({ tenantId: giftMonthDialog.tenantId, months: giftMonths });
      setGiftMonthDialog({ open: false });
      setGiftMonths(1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('admin_billing.title')}</h1>
          <p className="text-muted-foreground">
            Overzicht van alle tenant abonnementen en platform revenue
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.mrr || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin_billing.mrr')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.arr || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin_billing.arr')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Betalende klanten</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.payingCustomers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin_billing.paying_customers')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics?.churnRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Laatste 30 dagen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* At Risk Tenants */}
      {atRiskTenants.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('admin_billing.at_risk')} ({atRiskTenants.length})
            </CardTitle>
            <CardDescription>
              Tenants met achterstallige betalingen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Dagen achterstallig</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskTenants.map((tenant) => {
                  const daysOverdue = tenant.current_period_end 
                    ? Math.floor((Date.now() - new Date(tenant.current_period_end).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tenant.tenants?.name}</div>
                          <div className="text-sm text-muted-foreground">{tenant.tenants?.owner_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{tenant.pricing_plans?.name}</TableCell>
                      <TableCell>
                        {formatCurrency(
                          tenant.billing_interval === 'yearly' 
                            ? Number(tenant.pricing_plans?.yearly_price || 0) / 12
                            : Number(tenant.pricing_plans?.monthly_price || 0)
                        )}/mnd
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{daysOverdue} dagen</Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(`mailto:${tenant.tenants?.owner_email}`)}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Contact
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Revenue by Plan */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin_billing.subscribers_by_plan')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics?.byPlan.map((planData) => (
              <div key={planData.planId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{planData.planName}</div>
                  <Badge variant="secondary">{planData.count} tenants</Badge>
                </div>
                <div className="font-semibold">
                  {formatCurrency(planData.mrr)}/mnd
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Subscriptions & Invoices */}
      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">Abonnementen</TabsTrigger>
          <TabsTrigger value="invoices">Facturen</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op naam of email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Volgende facturatie</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sub.tenants?.name}</div>
                        <div className="text-sm text-muted-foreground">{sub.tenants?.owner_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {sub.pricing_plans?.name || 'Free'}
                    </TableCell>
                    <TableCell>
                      {sub.billing_interval === 'yearly' ? 'Jaarlijks' : 'Maandelijks'}
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>
                      {sub.current_period_end && format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: dateLocale })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setGiftMonthDialog({ 
                            open: true, 
                            tenantId: sub.tenant_id, 
                            tenantName: sub.tenants?.name 
                          })}
                        >
                          <Gift className="h-4 w-4 mr-1" />
                          Gift
                        </Button>
                        {sub.stripe_subscription_id && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => window.open(`https://dashboard.stripe.com/subscriptions/${sub.stripe_subscription_id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allInvoices.slice(0, 50).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {invoice.invoice_date && format(new Date(invoice.invoice_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{invoice.tenants?.name}</TableCell>
                    <TableCell>{invoice.invoice_number}</TableCell>
                    <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'destructive'}>
                        {invoice.status === 'paid' ? 'Betaald' : invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.hosted_invoice_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {invoice.status === 'paid' ? 'Bekijk factuur' : 'Betaal factuur'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Gift Month Dialog */}
      <Dialog open={giftMonthDialog.open} onOpenChange={(open) => setGiftMonthDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin_billing.gift_month')}</DialogTitle>
            <DialogDescription>
              Geef gratis maand(en) aan {giftMonthDialog.tenantName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Aantal maanden</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={giftMonths}
              onChange={(e) => setGiftMonths(parseInt(e.target.value) || 1)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGiftMonthDialog({ open: false })}>
              Annuleren
            </Button>
            <Button onClick={handleGiftMonth} disabled={giftMonth.isPending}>
              {giftMonth.isPending ? 'Bezig...' : 'Toepassen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
