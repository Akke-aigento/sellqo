// TENANT-CMD-1: de acties die op het tenant-detailscherm dagelijks nodig zijn,
// bovenaan in plaats van verstopt in een tab.
//
// De twee linkkaarten leunen op create-tenant-action-link (platform-admin-only,
// zie de auth-guard in supabase/functions/create-tenant-action-link/index.ts).
// Die functie gedraagt zich per action_type anders, en dat is hier zichtbaar:
//
//   connect_onboarding -> eigen token in tenant_action_tokens, antwoord
//                         { success, url, token, action_type }, 30 dagen geldig.
//   sepa_mandate       -> volledig gedelegeerd aan create-platform-mandate-setup;
//                         die payload komt VERBATIM terug, dus zonder action_type,
//                         en de token leeft daar 7 dagen (mandate_setup_tokens).
//
// Vandaar dat de code alleen op `url` leunt en de vervalhint PER KAART zet.
// Eén generieke "30 dagen" zou beloven dat een mandaatlink een maand meegaat
// terwijl hij na een week stil sterft.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, Link2, Copy, Check, Sparkles, Store, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';

type ActionType = 'connect_onboarding' | 'sepa_mandate';

interface TenantCommandStripProps {
  tenantId: string;
  /** Stripe-velden van de tenant; TenantDetail heeft de rij al opgehaald. */
  tenant: {
    stripe_account_id?: string | null;
    stripe_onboarding_complete?: boolean | null;
  } | null;
  /** Activeert een tab in TenantDetail — geen eigen kopie van die flow. */
  onNavigate: (tab: string) => void;
}

/** Gegenereerde link met kopieerknop. Bewust geen redirect: de link moet
 *  doorgestuurd worden, niet gevolgd. */
function GeneratedLink({ url, expiryLabel }: { url: string; expiryLabel: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link gekopieerd');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopiëren mislukt — selecteer de link handmatig');
    }
  };

  return (
    <div className="space-y-1 pt-2">
      <div className="flex items-center gap-1">
        <Input readOnly value={url} className="h-8 text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copy} title="Kopieer link" aria-label="Kopieer link">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{expiryLabel}</p>
    </div>
  );
}

export function TenantCommandStrip({ tenantId, tenant, onNavigate }: TenantCommandStripProps) {
  const { useTenantSubscription, useTenantCredits } = usePlatformAdmin();
  const { data: subscription, isLoading: subLoading } = useTenantSubscription(tenantId);
  const { data: credits, isLoading: creditsLoading } = useTenantCredits(tenantId);

  // usePlatformBillingStatus is hier niet bruikbaar: die leest de eigen tenant
  // uit TenantContext, niet de tenant die je als platform-admin bekijkt.
  const { data: mandate, isLoading: mandateLoading } = useQuery({
    queryKey: ['platform-tenant-mandate', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_payment_mandates')
        .select('id, status, method_type')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Per kaart eigen state, zodat de twee knoppen elkaar niet blokkeren.
  const [links, setLinks] = useState<Partial<Record<ActionType, string>>>({});
  const [busy, setBusy] = useState<ActionType | null>(null);

  const generateLink = async (actionType: ActionType) => {
    setBusy(actionType);
    try {
      // Alleen `url` is de gemene deler van beide action_types — zie de kop.
      const data = await invokeWithErrorBody<{ success?: boolean; url?: string; error?: string }>(
        'create-tenant-action-link',
        { body: { tenant_id: tenantId, action_type: actionType } },
      );
      if (!data?.url) throw new Error(data?.error || 'Geen link ontvangen');
      setLinks((prev) => ({ ...prev, [actionType]: data.url as string }));
      toast.success('Link aangemaakt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link aanmaken mislukt');
    } finally {
      setBusy(null);
    }
  };

  const planName = (subscription?.pricing_plans as { name?: string } | null)?.name || 'Geen plan';
  const creditsLeft = credits ? credits.credits_total - credits.credits_used : 0;

  // Dezelfde drietrapslogica als de Stripe-kaart in TenantOverviewTab, zodat
  // strook en tab nooit iets anders beweren over dezelfde tenant.
  const connectState = tenant?.stripe_account_id
    ? tenant?.stripe_onboarding_complete
      ? { label: 'Gekoppeld', variant: 'default' as const }
      : { label: 'Onboarding lopend', variant: 'secondary' as const }
    : { label: 'Niet gekoppeld', variant: 'outline' as const };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {/* 1. Abonnement */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Abonnement</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          {subLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <>
              <div className="text-xl font-bold leading-tight">{planName}</div>
              <p className="text-xs text-muted-foreground">Status: {subscription?.status || 'Geen'}</p>
            </>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate('billing')}>
            Activeer abonnement <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* 2. SEPA-mandaat */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SEPA-mandaat</CardTitle>
          <Link2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          {mandateLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <div>
              <Badge variant={mandate ? 'default' : 'outline'}>{mandate ? 'Actief' : 'Geen mandaat'}</Badge>
              {mandate?.method_type && (
                <p className="text-xs text-muted-foreground mt-1">{mandate.method_type}</p>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => generateLink('sepa_mandate')}
            disabled={busy === 'sepa_mandate'}
          >
            {busy === 'sepa_mandate' ? 'Bezig…' : 'Genereer mandaatlink'}
          </Button>
          {links.sepa_mandate && (
            <GeneratedLink url={links.sepa_mandate} expiryLabel="Verloopt over 7 dagen" />
          )}
        </CardContent>
      </Card>

      {/* 3. Webshop / Connect */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Webshop</CardTitle>
          <Store className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Badge variant={connectState.variant}>{connectState.label}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => generateLink('connect_onboarding')}
            disabled={busy === 'connect_onboarding'}
          >
            {busy === 'connect_onboarding' ? 'Bezig…' : 'Genereer onboarding-link'}
          </Button>
          {links.connect_onboarding && (
            <GeneratedLink url={links.connect_onboarding} expiryLabel="Verloopt over 30 dagen" />
          )}
        </CardContent>
      </Card>

      {/* 4. AI Credits */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Credits</CardTitle>
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {creditsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <div className="text-2xl font-bold">{creditsLeft}</div>
              <p className="text-xs text-muted-foreground">
                {credits?.credits_used || 0} gebruikt van {credits?.credits_total || 0}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
