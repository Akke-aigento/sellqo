import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Lock, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageMeta } from '@/components/seo/PageMeta';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * PAY-LINK-1 — sellqo.app/betalen/<token>: de vaste betaallink van één post
 * (betaalverzoek of factuur) of van "Alles betalen".
 *
 * Openen toont wat er betaald wordt; pas een klik op "Betalen" maakt een verse
 * Stripe-sessie (mailscanners openen links automatisch). Toont het merk van de
 * winkel van de post — bij een gewone winkel dus niet SellQo, met klein
 * "Mogelijk gemaakt door SellQo" onderaan. Laadt met een neutraal skelet: het
 * merk is pas bekend na het antwoord, dus geen SellQo-logo vooraf.
 */

type LinkState = 'open' | 'paid' | 'cancelled' | 'processing' | 'not_found' | 'nothing_open' | 'redirect' | 'rate_limited' | 'error';

interface PayInfo {
  state: LinkState;
  kind?: 'cycle' | 'invoice' | 'customer';
  brand?: { name: string; logoUrl: string | null; primaryColor: string; poweredBySellqo: boolean };
  items?: Array<{ type: 'cycle' | 'invoice'; number: string | null; amount: number }>;
  total?: number;
  currency?: string;
  url?: string;
}

async function callPayLink(action: 'info' | 'checkout', token: string): Promise<PayInfo> {
  const { data, error } = await supabase.functions.invoke('pay-link', { body: { action, token } });
  if (!error) return data as PayInfo;
  // Een 404/429/500 draagt zijn staat in de body.
  try {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = ctx?.json ? ((await ctx.json()) as PayInfo) : null;
    if (body?.state) return body;
  } catch {
    /* val terug op error */
  }
  return { state: 'error' };
}

const POLL_MS = 3000;
const POLL_MAX = 10;

export default function PayLink() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const justPaid = searchParams.get('betaald') === '1';

  const [info, setInfo] = useState<PayInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [polls, setPolls] = useState(0);

  const load = useCallback(async () => setInfo(await callPayLink('info', token)), [token]);
  useEffect(() => { void load(); }, [load]);

  // Terug van Stripe: de webhook kan een paar seconden achterlopen. Zolang de
  // post nog "open" lijkt, tonen we "in verwerking" (nooit opnieuw de knop) en
  // kijken we kort opnieuw.
  useEffect(() => {
    if (!justPaid || info?.state !== 'open' || polls >= POLL_MAX) return;
    const id = setTimeout(() => { setPolls((n) => n + 1); void load(); }, POLL_MS);
    return () => clearTimeout(id);
  }, [justPaid, info?.state, polls, load]);

  const pay = async () => {
    setBusy(true);
    const result = await callPayLink('checkout', token);
    if (result.state === 'redirect' && result.url) {
      window.location.assign(result.url);
      return;
    }
    setInfo(result);
    setBusy(false);
  };

  const money = (amount: number) =>
    new Intl.NumberFormat(i18n.language || 'nl', { style: 'currency', currency: (info?.currency || 'eur').toUpperCase() }).format(amount);

  const state: LinkState | null = info ? (justPaid && info.state === 'open' ? 'processing' : info.state) : null;
  const brand = info?.brand;
  const accent = brand?.primaryColor || '#1d3a5f';

  const message = (() => {
    switch (state) {
      case 'paid':
        return { icon: CheckCircle2, title: t('public.pay.link.paidTitle'), body: info?.kind === 'invoice' ? t('public.pay.link.paidInvoice') : t('public.pay.link.paidCycle') };
      case 'cancelled':
        return { icon: XCircle, title: t('public.pay.link.cancelledTitle'), body: t('public.pay.link.cancelledBody') };
      case 'processing':
        return { icon: Clock, title: t('public.pay.link.processingTitle'), body: t('public.pay.link.processingBody') };
      case 'nothing_open':
        return { icon: CheckCircle2, title: t('public.pay.link.nothingOpenTitle'), body: t('public.pay.link.nothingOpenBody') };
      case 'not_found':
        return { icon: AlertTriangle, title: t('public.pay.link.notFoundTitle'), body: t('public.pay.link.notFoundBody') };
      case 'rate_limited':
        return { icon: Clock, title: t('public.pay.link.rateLimitedTitle'), body: t('public.pay.link.rateLimitedBody') };
      case 'error':
        return { icon: AlertTriangle, title: t('public.pay.link.errorTitle'), body: t('public.pay.link.errorBody') };
      default:
        return null;
    }
  })();

  return (
    <main className="min-h-dvh overflow-x-hidden bg-muted/30 px-4 py-10 sm:py-16">
      <PageMeta title={t('public.pay.link.metaTitle')} description={t('public.pay.link.metaDescription')} path={`/betalen/${token}`} noindex />
      <div className="mx-auto w-full max-w-md min-w-0">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col gap-6 px-6 py-8 sm:px-8">
            {!info ? (
              <div className="space-y-4" aria-busy="true" aria-label={t('public.pay.link.loading')}>
                <Skeleton className="mx-auto h-12 w-32" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : (
              <>
                {brand && (
                  <div className="flex flex-col items-center gap-3 text-center">
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.name} width={160} height={48} className="h-12 w-auto max-w-[200px] object-contain" />
                    ) : (
                      <p className="text-xl font-semibold" style={{ color: accent }}>{brand.name}</p>
                    )}
                  </div>
                )}

                {message ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <message.icon className="h-10 w-10 shrink-0" style={{ color: accent }} strokeWidth={1.75} />
                    <h1 className="text-xl font-semibold tracking-tight">{message.title}</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">{message.body}</p>
                  </div>
                ) : (
                  <>
                    <h1 className="text-center text-lg font-semibold tracking-tight">
                      {t('public.pay.link.paymentTo', { shop: brand?.name ?? '' })}
                    </h1>
                    <ul className="divide-y rounded-lg border">
                      {(info.items ?? []).map((item, i) => (
                        <li key={`${item.type}-${item.number ?? i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <span className="min-w-0 truncate">
                            {item.type === 'cycle' ? t('public.pay.link.itemCycle') : t('public.pay.link.itemInvoice')}
                            {item.number ? <span className="ml-1 font-mono text-muted-foreground">{item.number}</span> : null}
                          </span>
                          <span className="shrink-0 font-medium">{money(item.amount)}</span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between gap-3 px-4 py-3 font-semibold">
                        <span>{t('public.pay.link.total')}</span>
                        <span className="shrink-0">{money(info.total ?? 0)}</span>
                      </li>
                    </ul>
                    <Button
                      size="lg"
                      className="w-full text-white"
                      style={{ backgroundColor: accent }}
                      disabled={busy}
                      onClick={pay}
                    >
                      {busy ? t('public.pay.link.redirecting') : t('public.pay.link.payButton')}
                    </Button>
                    <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      {t('public.pay.link.securedBy')}
                    </p>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
        {brand?.poweredBySellqo && (
          <p className="mt-4 text-center text-xs text-muted-foreground">{t('public.pay.link.poweredBy')}</p>
        )}
      </div>
    </main>
  );
}
