// SOCIAL-2 — Social planning: alle geplande posts per week, met goedkeuren,
// aanpassen en schrappen. Goedgekeurde posts publiceert social-publish-due elke 5 minuten.
// SOCIAL-5: tab "Resultaten" met de cijfers per post, dagdeel, weekdag en soort.
// MARKETING-3: geen tab "Maken" meer; één knop "Post met AI" (?ai=post opent hem).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ChevronsDownUp, ChevronsUpDown, Link2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SocialPlannerCard } from '@/components/admin/marketing/social/SocialPlannerCard';
import { SocialPlannerWeek } from '@/components/admin/marketing/social/SocialPlannerWeek';
import { weekKind, weekNeedsAction } from '@/lib/social/weeks';
import { SocialImageTextEditor } from '@/components/admin/marketing/social/SocialImageTextEditor';
import { SocialMediaViewer } from '@/components/admin/marketing/social/SocialMediaViewer';
import { SocialTranslateDialog } from '@/components/admin/marketing/social/SocialTranslateDialog';
import { SocialResults } from '@/components/admin/marketing/social/SocialResults';
import { SocialAIPostDialog } from '@/components/admin/marketing/social/SocialAIPostDialog';
import { CreditPurchaseDialog } from '@/components/admin/marketing/CreditPurchaseDialog';
import { useAICredits } from '@/hooks/useAICredits';
import { useAICreditsReturn } from '@/hooks/useAICreditsReturn';
import { SocialChannels } from '@/components/admin/marketing/social/SocialChannels';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { postMedia } from '@/lib/social/media';
import { useTenant } from '@/hooks/useTenant';
import { useSocialPlanner, type PlannerPost, type PlannerWeek } from '@/hooks/useSocialPlanner';
import { useSocialChannelStatus } from '@/hooks/useSocialChannelStatus';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useCan } from '@/hooks/useCan';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';

/** ISO-tijdstip naar de waarden van <input type="date"> en <input type="time">, in lokale tijd. */
function toLocalParts(iso: string | null): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date();
  return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') };
}

export default function SocialPlanner() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { weeks, pendingCount, isLoading, approve, update, remove, markPosted, chooseOwnMusic, requestRegenerate, saveImageText, saveTranslation, postNow } = useSocialPlanner();
  const { currentTenant } = useTenant();
  // SOCIAL-6: ?tab=results opent meteen de resultaten (link uit de maandagmelding).
  const [searchParams, setSearchParams] = useSearchParams();
  // MARKETING-3: "Post met AI" volgt dezelfde rechten als de vroegere AI Content Hub:
  // rol met ai_assistant-leesrecht, en niet verborgen voor deze winkel (hidden_pages 'ai-tools').
  const canAI = useCan('read', 'ai_assistant');
  const { isPageHidden } = useTenantPageOverrides();
  const showAI = canAI && !isPageHidden('ai-tools');
  const rawTab = searchParams.get('tab');
  const tab = rawTab === 'results' || rawTab === 'channels' ? rawTab : 'planning';

  const [aiOpen, setAiOpen] = useState(false);
  const [aiProductIds, setAiProductIds] = useState<string[] | undefined>(undefined);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const { refetch: refetchCredits } = useAICredits();
  const openPurchase = useCallback(() => setPurchaseOpen(true), []);
  const onCreditsBack = useCallback(() => { void refetchCredits(); }, [refetchCredits]);
  // Terugkeer uit de Stripe-checkout voor AI-credits (via de doorverwijzing van /admin/marketing/ai).
  useAICreditsReturn(openPurchase, onCreditsBack);

  // ?ai=post (en de oude ?tab=create&tool=social) opent de dialoog, eventueel met ?product=.
  // Pas opruimen zodra de rechten bekend zijn, anders verdwijnt de link vóór hij kan openen.
  useEffect(() => {
    const wantsAI = searchParams.get('ai') === 'post' || searchParams.get('tab') === 'create';
    if (!wantsAI || !showAI) return;
    const product = searchParams.get('product');
    setAiProductIds(product ? [product] : undefined);
    setAiOpen(true);
    const next = new URLSearchParams(searchParams);
    ['ai', 'tool', 'product'].forEach((k) => next.delete(k));
    if (next.get('tab') === 'create') next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, showAI]);

  // SOCIAL-WEEKS-1: welke weken open staan. Standaard deze week en weken die actie vragen;
  // wat je zelf open- of dichtklapt, onthoudt de browser per winkel (enkel gemak, geen data).
  const weeksStorageKey = currentTenant?.id ? `sellqo.socialPlanner.openWeeks.${currentTenant.id}` : null;
  const [weekOverrides, setWeekOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!weeksStorageKey) return;
    try {
      const raw = window.localStorage.getItem(weeksStorageKey);
      setWeekOverrides(raw ? JSON.parse(raw) : {});
    } catch {
      setWeekOverrides({});
    }
  }, [weeksStorageKey]);
  const saveWeekOverrides = useCallback((next: Record<string, boolean>) => {
    setWeekOverrides(next);
    if (!weeksStorageKey) return;
    try {
      window.localStorage.setItem(weeksStorageKey, JSON.stringify(next));
    } catch {
      // opslag niet beschikbaar: enkel voor deze sessie onthouden
    }
  }, [weeksStorageKey]);
  const isWeekOpen = useCallback((week: PlannerWeek) =>
    weekOverrides[week.weekStart] ?? (weekKind(week.weekStart) === 'this' || weekNeedsAction(week)),
  [weekOverrides]);
  const setWeekOpen = (weekStart: string, open: boolean) =>
    saveWeekOverrides({ ...weekOverrides, [weekStart]: open });
  const allOpen = useMemo(() => weeks.length > 0 && weeks.every(isWeekOpen), [weeks, isWeekOpen]);
  const setAllWeeksOpen = (open: boolean) =>
    saveWeekOverrides(Object.fromEntries(weeks.map((w) => [w.weekStart, open])));

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlannerPost | null>(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [removing, setRemoving] = useState<PlannerPost | null>(null);
  const [regenerating, setRegenerating] = useState<PlannerPost | null>(null);
  const [regenNote, setRegenNote] = useState('');
  const [regenLanguage, setRegenLanguage] = useState<string>('same');
  const [editingImage, setEditingImage] = useState<PlannerPost | null>(null);
  const [viewing, setViewing] = useState<PlannerPost | null>(null);
  const [translating, setTranslating] = useState<PlannerPost | null>(null);
  const [posting, setPosting] = useState<PlannerPost | null>(null);

  const confirmPostNow = async () => {
    if (!posting) return;
    const post = posting;
    setPosting(null);
    setBusyId(post.id);
    try {
      const outcome = await postNow.mutateAsync(post.id);
      if (outcome.status === 'posted') toast.success(t('admin.socialPlanner.postNow.posted'));
      else if (outcome.status === 'processing') toast.info(t('admin.socialPlanner.postNow.processing'));
      else if (outcome.status === 'retry') toast.warning(t('admin.socialPlanner.postNow.retry', { message: outcome.error }));
      else toast.error(t('admin.socialPlanner.postNow.failed', { message: outcome.error }));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const mediaOf = (post: PlannerPost) => postMedia(post, {
    image: (n) => t('admin.socialPlanner.media.image', { n }),
    video: t('admin.socialPlanner.media.video'),
    silent: t('admin.socialPlanner.media.silent'),
    cover: t('admin.socialPlanner.media.cover'),
  });

  // MARKETING-1: status zonder tokens, zodat ook de rol marketing de juiste melding ziet.
  const { canPublish: hasConnection, isLoading: channelsLoading } = useSocialChannelStatus();

  const fail = (err: unknown) =>
    toast.error(t('admin.socialPlanner.toast.error', { message: (err as Error)?.message ?? '' }));

  const handleApprove = async (ids: string[], weekly = false) => {
    setBusyId(weekly ? `week:${ids.join(',')}` : ids[0]);
    try {
      const count = await approve.mutateAsync(ids);
      toast.success(weekly
        ? t('admin.socialPlanner.toast.weekApproved', { count })
        : t('admin.socialPlanner.toast.approved'));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (post: PlannerPost) => {
    const parts = toLocalParts(post.scheduled_for);
    setEditing(post);
    setEditText(post.post_text ?? '');
    setEditDate(parts.date);
    setEditTime(parts.time);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const when = new Date(`${editDate}T${editTime}`);
    if (Number.isNaN(when.getTime())) {
      toast.error(t('admin.socialPlanner.invalidDate'));
      return;
    }
    try {
      await update.mutateAsync({ post: editing, text: editText, scheduledFor: when.toISOString() });
      toast.success(t('admin.socialPlanner.toast.saved'));
      setEditing(null);
    } catch (err) {
      fail(err);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      await remove.mutateAsync(removing.id);
      toast.success(t('admin.socialPlanner.toast.removed'));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
      setRemoving(null);
    }
  };

  const handleMarkPosted = async (post: PlannerPost) => {
    setBusyId(post.id);
    try {
      await markPosted.mutateAsync(post.id);
      toast.success(t('admin.socialPlanner.toast.markedPosted'));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleOwnMusic = async (post: PlannerPost) => {
    setBusyId(post.id);
    try {
      await chooseOwnMusic.mutateAsync(post.id);
      toast.success(t('admin.socialPlanner.toast.ownMusic'));
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRegenerate = async () => {
    if (!regenerating) return;
    try {
      await requestRegenerate.mutateAsync({
        post: regenerating,
        note: regenNote,
        language: regenLanguage === 'same' ? null : regenLanguage,
      });
      toast.success(t('admin.socialPlanner.toast.regenerateRequested'));
      setRegenerating(null);
      setRegenNote('');
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.socialPlanner.title')}
        description={t('admin.socialPlanner.description')}
        actions={showAI ? (
          <Button onClick={() => { setAiProductIds(undefined); setAiOpen(true); }}>
            <Sparkles className="h-4 w-4 mr-1" />
            {t('admin.socialPlanner.aiPost.button')}
          </Button>
        ) : undefined}
      />

      <Tabs value={tab} onValueChange={(v) => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (v === 'planning') next.delete('tab'); else next.set('tab', v); return next; }, { replace: true })} className="space-y-6">
        <TabsList scrollHint>
          <TabsTrigger value="planning">{t('admin.socialPlanner.tabs.planning')}</TabsTrigger>
          <TabsTrigger value="results">{t('admin.socialPlanner.tabs.results')}</TabsTrigger>
          <TabsTrigger value="channels">{t('admin.socialPlanner.tabs.channels')}</TabsTrigger>
        </TabsList>
        <TabsContent value="planning" className="space-y-6 mt-0">

      {!isLoading && !channelsLoading && !hasConnection && (
        <Alert>
          <Link2 className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span>{t('admin.socialPlanner.noConnection')}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/marketing/social?tab=channels">{t('admin.socialPlanner.toConnect')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {(pendingCount > 0 || weeks.length > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {pendingCount > 0 ? (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t('admin.socialPlanner.waiting', { count: pendingCount })}
            </p>
          ) : <span />}
          {weeks.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setAllWeeksOpen(!allOpen)}>
              {allOpen ? <ChevronsDownUp className="h-4 w-4 mr-1" /> : <ChevronsUpDown className="h-4 w-4 mr-1" />}
              {t(allOpen ? 'admin.socialPlanner.weekGroup.collapseAll' : 'admin.socialPlanner.weekGroup.expandAll')}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-96 w-full" />)}
        </div>
      ) : weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center max-w-md mx-auto">
          {t('admin.socialPlanner.empty')}
        </p>
      ) : (
        weeks.map((week) => {
          const weekBusy = busyId === `week:${week.pendingIds.join(',')}`;
          return (
            <SocialPlannerWeek
              key={week.weekStart}
              week={week}
              open={isWeekOpen(week)}
              onOpenChange={(open) => setWeekOpen(week.weekStart, open)}
              busy={weekBusy}
              onApproveWeek={() => handleApprove(week.pendingIds, true)}
            >
                {week.posts.map((post) => (
                  <SocialPlannerCard
                    key={post.id}
                    post={post}
                    busy={busyId === post.id || weekBusy}
                    onApprove={() => handleApprove([post.id])}
                    onEdit={() => openEdit(post)}
                    onRemove={() => setRemoving(post)}
                    onMarkPosted={() => handleMarkPosted(post)}
                    onChooseOwnMusic={() => handleOwnMusic(post)}
                    onRegenerate={() => { setRegenerating(post); setRegenNote(''); setRegenLanguage('same'); }}
                    onEditImageText={() => setEditingImage(post)}
                    onViewMedia={() => setViewing(post)}
                    onTranslate={() => setTranslating(post)}
                    onPostNow={() => setPosting(post)}
                    media={mediaOf(post)}
                  />
                ))}
            </SocialPlannerWeek>
          );
        })
      )}
        </TabsContent>
        <TabsContent value="results" className="mt-0">
          <SocialResults />
        </TabsContent>
        <TabsContent value="channels" className="mt-0">
          <SocialChannels />
        </TabsContent>
      </Tabs>

      <ResponsiveDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.status === 'failed' ? t('admin.socialPlanner.rescheduleTitle') : t('admin.socialPlanner.editTitle')}
        footer={
          <div className="flex w-full gap-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={saveEdit} disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="social-edit-text">{t('admin.socialPlanner.caption')}</Label>
            <Textarea
              id="social-edit-text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={10}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground text-right">{editText.length} / 2200</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="social-edit-date">{t('admin.socialPlanner.date')}</Label>
              <Input id="social-edit-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-edit-time">{t('admin.socialPlanner.time')}</Label>
              <Input id="social-edit-time" type="time" step={3600} value={editTime} onChange={(e) => setEditTime(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.hourHint')}</p>
        </div>
      </ResponsiveDialog>

      {showAI && (
        <SocialAIPostDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          productIds={aiProductIds}
          onNeedCredits={openPurchase}
        />
      )}
      <CreditPurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />

      <SocialMediaViewer post={viewing} items={viewing ? mediaOf(viewing) : []} onClose={() => setViewing(null)} />

      <SocialTranslateDialog
        post={translating}
        tenantId={currentTenant?.id}
        onClose={() => setTranslating(null)}
        onSave={async (r) => {
          await saveTranslation.mutateAsync({ post: r.post, language: r.language, caption: r.caption, images: r.images });
        }}
        onRegenerateInLanguage={async (post, language) => {
          await requestRegenerate.mutateAsync({ post, note: '', language });
        }}
      />

      <SocialImageTextEditor
        post={editingImage}
        onClose={() => setEditingImage(null)}
        onSave={async (input) => {
          await saveImageText.mutateAsync({ ...input, recipe: input.recipe as unknown as Record<string, unknown> });
        }}
      />

      <ResponsiveDialog
        open={!!regenerating}
        onOpenChange={(open) => !open && setRegenerating(null)}
        title={t('admin.socialPlanner.regenerate.title')}
        footer={
          <div className="flex w-full gap-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setRegenerating(null)}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={confirmRegenerate} disabled={requestRegenerate.isPending}>
              {requestRegenerate.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('admin.socialPlanner.regenerate.confirm')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('admin.socialPlanner.regenerate.body')}</p>
          <div className="space-y-2">
            <Label htmlFor="social-regen-language">{t('admin.socialPlanner.regenerate.languageLabel')}</Label>
            <Select value={regenLanguage} onValueChange={setRegenLanguage}>
              <SelectTrigger id="social-regen-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">{t('admin.socialPlanner.regenerate.sameLanguage')}</SelectItem>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social-regen-note">{t('admin.socialPlanner.regenerate.noteLabel')}</Label>
            <Textarea
              id="social-regen-note"
              value={regenNote}
              onChange={(e) => setRegenNote(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder={t('admin.socialPlanner.regenerate.notePlaceholder')}
              className="text-sm"
            />
          </div>
        </div>
      </ResponsiveDialog>

      <AlertDialog open={!!posting} onOpenChange={(open) => !open && setPosting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.socialPlanner.postNow.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.socialPlanner.postNow.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPostNow}>{t('admin.socialPlanner.postNow.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.socialPlanner.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.socialPlanner.removeBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('admin.socialPlanner.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
