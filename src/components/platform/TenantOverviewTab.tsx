import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Users, Package, ShoppingCart, Calendar, Euro, Mail, CreditCard, Unlink, Loader2, Copy } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TenantOverviewTabProps {
  tenantId: string;
}

export function TenantOverviewTab({ tenantId }: TenantOverviewTabProps) {
  const { useTenantDetail, useTenantSubscription, useTenantCredits, useTenantOwner } = usePlatformAdmin();
  const { data: tenant, isLoading: tenantLoading } = useTenantDetail(tenantId);
  const { data: subscription, isLoading: subLoading } = useTenantSubscription(tenantId);
  const { data: credits, isLoading: creditsLoading } = useTenantCredits(tenantId);
  const { data: owner, isLoading: ownerLoading } = useTenantOwner(tenantId);

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const queryClient = useQueryClient();
  const isLoading = tenantLoading || subLoading || creditsLoading || ownerLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const planName = (subscription?.pricing_plans as { name?: string } | null)?.name || 'Geen plan';
  const tenantData = tenant as {
    id?: string;
    name?: string;
    slug?: string;
    subscription_status?: string;
    created_at?: string;
    updated_at?: string;
    lifetime_revenue?: number;
    lifetime_order_count?: number;
    lifetime_customer_count?: number;
    stripe_account_id?: string;
    stripe_onboarding_complete?: boolean;
  } | null;

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '€0,00';
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards - Primary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abonnement</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planName}</div>
            <p className="text-xs text-muted-foreground">
              Status: {subscription?.status || 'Geen'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Credits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {credits ? credits.credits_total - credits.credits_used : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {credits?.credits_used || 0} gebruikt van {credits?.credits_total || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gekochte Credits</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits?.credits_purchased || 0}</div>
            <p className="text-xs text-muted-foreground">Extra gekocht</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aangemaakt</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenantData?.created_at
                ? format(new Date(tenantData.created_at), 'dd MMM yyyy', { locale: nl })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Registratiedatum</p>
          </CardContent>
        </Card>
      </div>

      {/* Lifetime Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Revenue</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(tenantData?.lifetime_revenue)}
            </div>
            <p className="text-xs text-muted-foreground">Totale omzet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenantData?.lifetime_order_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Totaal bestellingen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenantData?.lifetime_customer_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Totaal klanten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stripe Status</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {tenantData?.stripe_account_id ? (
                  tenantData?.stripe_onboarding_complete ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Actief</Badge>
                  ) : (
                    <Badge variant="secondary">Onboarding</Badge>
                  )
                ) : (
                  <Badge variant="outline">Niet verbonden</Badge>
                )}
              </div>
              {tenantData?.stripe_account_id && (
                <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDisconnecting}>
                      {isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Stripe account ontkoppelen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Weet je zeker dat je het Stripe account wilt ontkoppelen? Dit verwijdert het connected account permanent uit Stripe. De tenant zal opnieuw moeten onboarden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async () => {
                          setIsDisconnecting(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('disconnect-stripe-account', {
                              body: { tenant_id: tenantId },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            toast.success('Stripe account ontkoppeld en verwijderd');
                            queryClient.invalidateQueries({ queryKey: ['tenant-detail', tenantId] });
                          } catch (err: any) {
                            toast.error(err.message || 'Ontkoppelen mislukt');
                          } finally {
                            setIsDisconnecting(false);
                            setShowDisconnectDialog(false);
                          }
                        }}
                      >
                        Ontkoppelen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {tenantData?.stripe_account_id || 'Geen account'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Details */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Tenant ID</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm bg-muted px-2 py-1 rounded select-all break-all">
                {tenantData?.id || tenantId}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  const id = tenantData?.id || tenantId;
                  navigator.clipboard.writeText(id);
                  toast.success('Tenant ID gekopieerd');
                }}
                aria-label="Kopieer Tenant ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Naam</p>
              <p className="text-lg">{tenantData?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Slug</p>
              <p className="text-lg">{tenantData?.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-lg">{tenantData?.subscription_status || 'Onbekend'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Laatst bijgewerkt</p>
              <p className="text-lg">
                {tenantData?.updated_at
                  ? format(new Date(tenantData.updated_at), 'dd MMM yyyy HH:mm', { locale: nl })
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Owner Details */}
      {owner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Eigenaar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Naam</p>
                <p className="text-lg">{owner.full_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-lg">{owner.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Laatste login</p>
                <p className="text-lg">
                  {owner.last_sign_in_at
                    ? format(new Date(owner.last_sign_in_at), 'dd MMM yyyy HH:mm', { locale: nl })
                    : 'Nog nooit'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Account aangemaakt</p>
                <p className="text-lg">
                  {owner.created_at
                    ? format(new Date(owner.created_at), 'dd MMM yyyy', { locale: nl })
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
