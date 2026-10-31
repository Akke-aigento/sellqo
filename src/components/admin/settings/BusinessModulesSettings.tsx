// MODULES-1 → TRACKS-1 → ADDON-SELF-1 — "Je pakket": het plan en de sporen van de winkel.
// Het plan bepaalt het hoofdspoor; extra sporen zijn betalende add-ons. Sinds ADDON-SELF-1 zet
// de zaakvoerder (tenant_admin) ze zelf aan of uit, met vooraf exact wat het vandaag kost.
// Een spoor gaat pas aan na betaling (pay-first). Dezelfde kaart staat in het platformbeheer
// (TenantDetail › Facturatie) met `tenantId`, zodat SellQo één plek heeft per winkel.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ExternalLink, Loader2, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useTracks, type BusinessModule } from '@/hooks/useBusinessModules';
import { useTenantPackage, type AddonErrorCode, type PackageAddon } from '@/hooks/useTenantPackage';

const MODULES: { id: BusinessModule; icon: LucideIcon; to: string; demo?: string; points: string[] }[] = [
  {
    id: 'webshop', icon: ShoppingBag, to: '/admin/products',
    points: ['admin.modules.webshop_p1', 'admin.modules.webshop_p2', 'admin.modules.webshop_p3'],
  },
  {
    id: 'horeca', icon: UtensilsCrossed, to: '/admin/bestellen', demo: 'https://demo-pizzeria.sellqo.shop',
    points: ['admin.modules.horeca_p1', 'admin.modules.horeca_p2', 'admin.modules.horeca_p3', 'admin.modules.horeca_p4'],
  },
  {
    id: 'events', icon: CalendarDays, to: '/admin/events',
    points: ['admin.modules.events_p1', 'admin.modules.events_p2', 'admin.modules.events_p3'],
  },
];

type Pending = { addon: PackageAddon; on: boolean } | null;

export function BusinessModulesSettings({ tenantId }: { tenantId?: string } = {}) {
  const { t, i18n } = useTranslation();
  const { isPlatformAdmin } = useAuth();
  const { planTrack: ownPlanTrack, tracks: ownTracks } = useTracks();
  const { pkg, loading, failed, canManage, setAddon, busy } = useTenantPackage(tenantId);
  const [confirm, setConfirm] = useState<Pending>(null);
  const embedded = !!tenantId;

  const money = (n: number) => n.toLocaleString(i18n.language, { style: 'currency', currency: 'EUR' });
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(i18n.language) : '');
  const nameOf = (m: BusinessModule) => t(`admin.modules.${m}_title`);
  const priceOf = (a: PackageAddon, interval: 'monthly' | 'yearly' = pkg?.plan.interval ?? 'monthly') =>
    interval === 'yearly'
      ? t('admin.modules.price_year', { price: money(a.yearly_price) })
      : t('admin.modules.price_month', { price: money(a.monthly_price) });

  const errorText = (code: AddonErrorCode | undefined, a: PackageAddon, availableFrom?: string) => {
    switch (code) {
      case 'addon_needs_plan': return t('admin.modules.needs_plan');
      case 'renewal_pending': return t('admin.modules.renewal_pending', { date: date(availableFrom) });
      case 'proration_cycle_open': return t('admin.modules.payment_open');
      case 'addon_granted': return t('admin.modules.err_granted', { name: nameOf(a.track) });
      case 'addon_in_plan': return t('admin.modules.err_in_plan', { name: nameOf(a.track) });
      case 'account_locked': return t('admin.modules.err_locked');
      case 'addon_inactive': return t('admin.modules.err_inactive');
      case 'addon_in_use': return t('admin.modules.in_use_hint', { name: nameOf(a.track) });
      default: return t('admin.modules.save_failed');
    }
  };

  const run = async (force = false) => {
    if (!confirm) return;
    const { addon: a, on } = confirm;
    const res = await setAddon(a.id, on, { force });
    setConfirm(null);
    const name = nameOf(a.track);
    if (!res.ok) { toast.error(errorText(res.error, a, res.availableFrom)); return; }
    if (!on && a.status === 'pending_payment') { toast.success(t('admin.modules.withdrawn', { name })); return; }
    if (on && res.pending) {
      toast.info(t('admin.modules.payment_requested', { amount: money(res.total ?? 0), name }));
      // In het platformbeheer nooit naar de checkout van de klant springen.
      if (res.payUrl && !embedded) window.location.assign(res.payUrl);
      return;
    }
    if (on && res.trial) { toast.success(t('admin.modules.trial_on', { name })); return; }
    if (on) { toast.success(t('admin.modules.turned_on', { name })); return; }
    if (res.effectiveAt && new Date(res.effectiveAt).getTime() > Date.now() + 60_000) {
      // Laatste betaalde dag = de dag vóór effective_at (zelfde datum als badge en venster).
      toast.info(t('admin.modules.off_at_period_end', { date: date(new Date(new Date(res.effectiveAt).getTime() - 864e5).toISOString()) }));
    } else toast.success(t('admin.modules.turned_off', { name }));
  };

  // Wat staat er in het venster vóór het aanzetten? Exact de 'quote' van de server.
  const onText = (a: PackageAddon): { lines: string[]; blocked?: string; paid: boolean } => {
    const name = nameOf(a.track);
    const q = a.quote;
    const fee = a.ticket_fee > 0 ? [t('admin.modules.price_tickets', { price: money(a.ticket_fee) })] : [];
    if (!q) return { lines: [], paid: false };
    switch (q.kind) {
      case 'free': return { lines: [t('admin.modules.q_free'), ...fee], paid: false };
      case 'trial': return { lines: [t('admin.modules.q_trial', { date: date(q.billed_from), price: priceOf(a) })], paid: false };
      case 'boundary': return { lines: [t('admin.modules.q_boundary', { price: priceOf(a, q.interval) })], paid: false };
      case 'first_month': return { lines: [t('admin.modules.q_first_month', { total: money(q.total), price: priceOf(a, 'monthly') }), t('admin.modules.after_payment', { name })], paid: true };
      case 'pro_rata': return { lines: [t('admin.modules.q_pro_rata', { total: money(q.total), date: date(q.period_end), price: priceOf(a, q.interval) }), t('admin.modules.after_payment', { name })], paid: true };
      case 'resume': return { lines: [t('admin.modules.q_resume', { name })], paid: false };
      case 'locked': return { lines: [], blocked: t('admin.modules.err_locked'), paid: false };
      case 'needs_plan': return { lines: [], blocked: t('admin.modules.needs_plan'), paid: false };
      case 'payment_open': return { lines: [], blocked: t('admin.modules.payment_open'), paid: false };
      case 'renewal_pending': return { lines: [], blocked: t('admin.modules.renewal_pending', { date: date(q.available_from) }), paid: false };
    }
  };

  const usageLines = (a: PackageAddon): string[] => {
    const u = a.usage;
    if (!u) return [];
    const out: string[] = [];
    if (a.track === 'horeca' && u.open_checks > 0) out.push(t('admin.modules.in_use_checks', { count: u.open_checks }));
    if (a.track === 'events' && u.upcoming_ticketed_events > 0) out.push(t('admin.modules.in_use_events', { count: u.upcoming_ticketed_events }));
    if (a.track === 'webshop' && u.open_orders > 0) out.push(t('admin.modules.in_use_orders', { count: u.open_orders }));
    return out;
  };

  const planTrack = pkg?.plan.track ?? ownPlanTrack;
  const dialog = confirm ? (() => {
    const { addon: a, on } = confirm;
    const name = nameOf(a.track);
    if (on) {
      const x = onText(a);
      return (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.modules.confirm_on_title', { name })}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {x.blocked ? <p>{x.blocked}</p> : x.lines.map((l) => <p key={l}>{l}</p>)}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            {!x.blocked ? (
              <AlertDialogAction disabled={!!busy} onClick={(e) => { e.preventDefault(); void run(); }}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {x.paid ? t('admin.modules.confirm_pay') : t('admin.modules.confirm_on')}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </>
      );
    }
    const withdraw = a.status === 'pending_payment';
    const inUse = withdraw ? [] : usageLines(a);
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>{withdraw ? t('admin.modules.withdraw_title') : inUse.length ? t('admin.modules.in_use_title') : t('admin.modules.confirm_off_title', { name })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {inUse.length ? (
                <>
                  <ul className="list-disc pl-4">{inUse.map((l) => <li key={l}>{l}</li>)}</ul>
                  <p>{t('admin.modules.in_use_hint', { name })}</p>
                </>
              ) : withdraw ? (
                <p>{t('admin.modules.withdraw_text', { name })}</p>
              ) : (
                <p>{a.stops_at ? t('admin.modules.off_at', { name, date: date(a.stops_at) }) : t('admin.modules.off_now', { name })}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          {!inUse.length ? (
            <AlertDialogAction disabled={!!busy} onClick={(e) => { e.preventDefault(); void run(); }}>{withdraw ? t('admin.modules.withdraw') : t('admin.modules.confirm_off')}</AlertDialogAction>
          ) : isPlatformAdmin ? (
            <AlertDialogAction disabled={!!busy} onClick={(e) => { e.preventDefault(); void run(true); }}>{t('admin.modules.force_off')}</AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </>
    );
  })() : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('admin.modules.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('admin.modules.intro')}</p>
      </div>

      {canManage && pkg ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t('admin.modules.plan_line', { plan: pkg.plan.name })}</span>
              {pkg.trial && pkg.trial_end ? <Badge variant="secondary" className="font-normal">{t('admin.modules.plan_trial', { date: date(pkg.trial_end) })}</Badge> : null}
            </div>
            {!embedded ? (
              <Button asChild variant="link" className="h-auto p-0 text-sm"><Link to="/admin/billing">{t('admin.modules.change_plan')}</Link></Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {canManage && loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : null}
      {canManage && failed ? <p className="text-sm text-destructive">{t('admin.modules.load_failed')}</p> : null}

      {/* Platformbeheer: pas tonen als het pakket van déze winkel geladen is (geen badges van je eigen winkel). */}
      {(embedded && !pkg) ? null : MODULES.map((m) => {
        const a = pkg?.addons.find((x) => x.track === m.id) ?? null;
        // Zonder pakket (geen beheerrechten): de sporen van de winkel zelf, enkel ter info.
        const status = a?.status ?? (planTrack === m.id ? 'in_plan' : ownTracks.includes(m.id) ? 'on' : 'off');
        const viaPlan = status === 'in_plan';
        const active = status === 'in_plan' || status === 'included' || status === 'on' || status === 'stopping' || status === 'trial';
        const switchable = canManage && !!a && !['in_plan', 'included', 'pending_payment'].includes(status);
        const Icon = m.icon;
        return (
          <Card key={m.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {nameOf(m.id)}
                    {status === 'in_plan' ? <Badge variant="secondary" className="font-normal">{t('admin.modules.via_plan')}</Badge> : null}
                    {status === 'included' ? <Badge variant="secondary" className="font-normal">{t('admin.modules.status_included')}</Badge> : null}
                    {status === 'on' ? <Badge variant="secondary" className="font-normal">{t('admin.modules.addon_active')}</Badge> : null}
                    {status === 'trial' ? <Badge variant="secondary" className="font-normal">{t('admin.modules.status_trial')}</Badge> : null}
                    {status === 'stopping' ? <Badge variant="outline" className="font-normal">{t('admin.modules.status_stopping', { date: date(a?.end_date) })}</Badge> : null}
                    {status === 'pending_payment' ? <Badge variant="outline" className="font-normal">{t('admin.modules.status_pending')}</Badge> : null}
                    {status === 'off' ? <Badge variant="outline" className="font-normal">{t('admin.modules.not_in_plan')}</Badge> : null}
                  </CardTitle>
                  <CardDescription>{t(`admin.modules.${m.id}_desc`)}</CardDescription>
                  {a && !viaPlan && status !== 'included' ? (
                    <p className="mt-1 text-sm font-medium">
                      {a.billed ? priceOf(a) : t('admin.modules.price_month', { price: money(0) })}
                      {a.ticket_fee > 0 ? ` · ${t('admin.modules.price_tickets', { price: money(a.ticket_fee) })}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              {switchable ? (
                <Switch
                  checked={status === 'on' || status === 'trial'}
                  disabled={!!busy}
                  aria-label={nameOf(m.id)}
                  onCheckedChange={(v) => a && setConfirm({ addon: a, on: v })}
                />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 pl-[3.75rem]">
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {m.points.map((p) => <li key={p}>{t(p)}</li>)}
              </ul>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {status === 'pending_payment' && a?.pending?.pay_url && !embedded ? (
                  <a href={a.pending.pay_url} className="font-medium text-primary hover:underline">
                    {t('admin.modules.pay_now', { amount: money(a.pending.total) })}
                  </a>
                ) : null}
                {status === 'pending_payment' && canManage && a ? (
                  <Button variant="link" className="h-auto p-0 text-sm text-muted-foreground" disabled={!!busy} onClick={() => setConfirm({ addon: a, on: false })}>
                    {t('admin.modules.withdraw')}
                  </Button>
                ) : null}
                {active && !embedded ? <Link to={m.to} className="font-medium text-primary hover:underline">{t('admin.modules.open', { name: nameOf(m.id) })}</Link> : null}
                {!active && !canManage ? <p className="text-xs text-muted-foreground">{t('admin.modules.ask_admin')}</p> : null}
                {m.demo && !embedded ? (
                  <a href={m.demo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    {t('admin.modules.see_demo')}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && !busy) setConfirm(null); }}>
        <AlertDialogContent>{dialog}</AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
