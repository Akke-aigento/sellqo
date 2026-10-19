import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Info, Loader2, Pencil, ShoppingCart, Star, UserPlus, RotateCcw, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReadOnlyBadge } from '@/components/permissions/ReadOnlyBadge';
import { AutomationStepDialog } from '@/components/admin/marketing/AutomationStepDialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useCan } from '@/hooks/useCan';
import { useToast } from '@/hooks/use-toast';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import {
  useAutomationRuns, useEmailAutomationActions, useEmailAutomations,
  type AutomationRunStatus, type AutomationStepView, type EmailAutomationView,
} from '@/hooks/useEmailAutomations';
import {
  DEFAULT_CART_DELAY_HOURS, DEFAULT_WIN_BACK_DAYS, PRESET_KEYS, type AutomationPresetKey,
} from '@/lib/marketing/automationPresets';

/**
 * MAIL-2a — Marketing → Automatiseringen.
 *
 * Vier vaste e-mailreeksen. De eerste keer aanzetten maakt de reeks aan via
 * automation_ensure_presets (uit, met standaardteksten) en zet hem daarna aan.
 */
type AutomationKind = AutomationPresetKey;
type EmailAutomation = EmailAutomationView;
type AutomationStep = AutomationStepView;

const KIND_ICON: Record<AutomationKind, LucideIcon> = {
  welcome_series: UserPlus,
  post_purchase: Star,
  win_back: RotateCcw,
  abandoned_cart: ShoppingCart,
};

const WIN_BACK_OPTIONS = [60, 90, 120, 180];
const CART_DELAY_OPTIONS = [1, 2, 4, 24];

const RUN_VARIANT: Record<AutomationRunStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  scheduled: 'secondary',
  running: 'secondary',
  completed: 'default',
  skipped: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
};

/** Is er een Google- of Trustpilot-profiel gekoppeld? Nodig voor de reviewvraag. */
function useHasReviewProfile() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['review-profile-connected', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('review_platform_connections')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .eq('is_enabled', true)
        .in('platform', ['google', 'trustpilot']);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

function stepHours(step: AutomationStep) {
  return (step.delay_hours ?? 0) + Math.round((step.delay_minutes ?? 0) / 60);
}

function winBackDays(automation: EmailAutomation) {
  const d = Number(automation.trigger_config?.days);
  return Number.isFinite(d) && d > 0 ? d : DEFAULT_WIN_BACK_DAYS;
}

function AutomationCard({
  kind, automation, canWrite, hasReviewProfile, onEditStep,
}: {
  kind: AutomationKind;
  automation?: EmailAutomation;
  canWrite: boolean;
  hasReviewProfile: boolean | undefined;
  onEditStep: (step: AutomationStep) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { setActive, setWinBackDays, setStepDelay } = useEmailAutomationActions();
  const Icon = KIND_ICON[kind];
  const active = !!automation?.is_active;
  const pending = setActive.isPending && setActive.variables?.presetKey === kind;
  const cartStep = kind === 'abandoned_cart' ? automation?.steps[0] : undefined;
  const base = `admin.marketing.automations.kinds.${kind}`;

  const toggle = async (next: boolean) => {
    try {
      await setActive.mutateAsync({ presetKey: kind, automationId: automation?.id, active: next });
      toast({ title: t(next ? 'admin.marketing.automations.toast.activated' : 'admin.marketing.automations.toast.deactivated') });
    } catch (e) {
      toast({
        title: t('admin.marketing.automations.toast.toggle_failed'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const saveSetting = async (key: 'win_back_days' | 'cart_delay_hours', value: number) => {
    if (!automation) return;
    try {
      if (key === 'win_back_days') await setWinBackDays.mutateAsync({ automation, days: value });
      else if (cartStep) await setStepDelay.mutateAsync({ stepId: cartStep.id, hours: value });
      toast({ title: t('admin.marketing.automations.toast.settings_saved') });
    } catch (e) {
      toast({
        title: t('admin.marketing.automations.toast.settings_failed'),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-muted rounded-lg shrink-0"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                {t(`${base}.title`)}
                <Badge variant={active ? 'default' : 'outline'}>
                  {t(active ? 'admin.marketing.automations.status_on' : 'admin.marketing.automations.status_off')}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">{t(`${base}.description`)}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={active}
              disabled={!canWrite || pending}
              onCheckedChange={toggle}
              aria-label={t(`${base}.title`)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {kind === 'win_back' && automation && (
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm">{t('admin.marketing.automations.settings.win_back_days')}</Label>
            <Select
              value={String(winBackDays(automation))}
              onValueChange={(v) => saveSetting('win_back_days', Number(v))}
              disabled={!canWrite}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WIN_BACK_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{t('admin.marketing.automations.settings.days', { count: d })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {kind === 'abandoned_cart' && cartStep && (
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm">{t('admin.marketing.automations.settings.cart_delay')}</Label>
            <Select
              value={String(CART_DELAY_OPTIONS.includes(stepHours(cartStep)) ? stepHours(cartStep) : DEFAULT_CART_DELAY_HOURS)}
              onValueChange={(v) => saveSetting('cart_delay_hours', Number(v))}
              disabled={!canWrite}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CART_DELAY_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>{t('admin.marketing.automations.settings.hours', { count: h })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {automation ? (
          <div className="rounded-md border divide-y">
            {automation.steps.map((step) => {
              const hours = step.step_key === 'win_back' ? null : stepHours(step);
              return (
                <div key={step.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {t(`admin.marketing.automations.steps.${step.step_key}`)}
                      {step.is_active === false && (
                        <Badge variant="outline" className="text-[10px]">{t('admin.marketing.automations.step_paused')}</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {hours === null
                        ? t('admin.marketing.automations.delay.win_back', { count: winBackDays(automation) })
                        : hours === 0
                          ? t('admin.marketing.automations.delay.immediate')
                          : t('admin.marketing.automations.delay.after_hours', { count: hours })}
                      {step.content.nl?.subject ? ` · ${step.content.nl.subject}` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onEditStep(step)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    {canWrite ? t('common.edit') : t('admin.marketing.automations.view')}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('admin.marketing.automations.not_created')}</p>
        )}

        {automation && (
          <p className="text-xs text-muted-foreground">
            {t('admin.marketing.automations.counters', {
              runs: automation.total_runs ?? 0,
              sent: automation.total_sent ?? 0,
            })}
          </p>
        )}

        {kind === 'post_purchase' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {t('admin.marketing.automations.notes.review')}{' '}
              {hasReviewProfile === false && (
                <span className="font-medium">{t('admin.marketing.automations.notes.review_none')} </span>
              )}
              <Link to="/admin/settings?section=reviews" className="underline">
                {t('admin.marketing.automations.notes.review_link')}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        {kind === 'abandoned_cart' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">{t('admin.marketing.automations.notes.cart_legal')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function MarketingAutomationsPage() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const canWrite = useCan('write', 'marketing');
  const { data: automations, isLoading } = useEmailAutomations();
  const { data: runs = [], isLoading: runsLoading } = useAutomationRuns();
  const { data: hasReviewProfile } = useHasReviewProfile();
  const [editing, setEditing] = useState<AutomationStep | null>(null);

  const nameById = new Map<string, AutomationKind>();
  const stepById = new Map<string, AutomationStep>();
  for (const k of PRESET_KEYS) {
    const a = automations?.[k];
    if (!a) continue;
    nameById.set(a.id, k);
    for (const s of a.steps) stepById.set(s.id, s);
  }
  // current_step telt vanaf 0 over de actieve stappen; next_step_id is exact zolang de run loopt.
  const stepKeyFor = (r: { automation_id: string; next_step_id: string | null; current_step: number | null }) => {
    if (r.next_step_id && stepById.has(r.next_step_id)) return stepById.get(r.next_step_id)!.step_key;
    const kind = nameById.get(r.automation_id);
    const steps = kind ? automations?.[kind]?.steps.filter((s) => s.is_active !== false) : undefined;
    return steps?.[r.current_step ?? 0]?.step_key ?? null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.marketing.automations.title')}
        description={t('admin.marketing.automations.subtitle')}
        actions={<ReadOnlyBadge resource="marketing" />}
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">{t('admin.marketing.automations.notes.limit')}</AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {PRESET_KEYS.map((kind) => (
            <AutomationCard
              key={kind}
              kind={kind}
              automation={automations?.[kind]}
              canWrite={canWrite}
              hasReviewProfile={hasReviewProfile}
              onEditStep={setEditing}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.marketing.automations.log.title')}</CardTitle>
          <CardDescription>{t('admin.marketing.automations.log.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('admin.marketing.automations.log.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.marketing.automations.log.col.date')}</TableHead>
                    <TableHead>{t('admin.marketing.automations.log.col.recipient')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.marketing.automations.log.col.automation')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('admin.marketing.automations.log.col.step')}</TableHead>
                    <TableHead>{t('admin.marketing.automations.log.col.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => {
                    const kind = nameById.get(r.automation_id);
                    const stepKey = stepKeyFor(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(r.scheduled_for || r.created_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{r.recipient_email || '—'}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {kind ? t(`admin.marketing.automations.kinds.${kind}.title`) : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {stepKey ? t(`admin.marketing.automations.steps.${stepKey}`) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={RUN_VARIANT[r.status] ?? 'outline'}>
                            {t(`admin.marketing.automations.log.status.${r.status}`, { defaultValue: r.status })}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AutomationStepDialog
        step={editing}
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        canWrite={canWrite}
      />
    </div>
  );
}
