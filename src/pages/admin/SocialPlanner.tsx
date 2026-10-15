// SOCIAL-2 — Social planning: alle geplande posts per week, met goedkeuren,
// aanpassen en schrappen. Goedgekeurde posts publiceert social-publish-due elk uur op :01.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { addDays, format } from 'date-fns';
import { CheckCheck, Link2, Loader2 } from 'lucide-react';
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
import { GatedButton } from '@/components/permissions/GatedButton';
import { SocialPlannerCard } from '@/components/admin/marketing/social/SocialPlannerCard';
import { SocialImageTextEditor } from '@/components/admin/marketing/social/SocialImageTextEditor';
import { useSocialPlanner, type PlannerPost } from '@/hooks/useSocialPlanner';
import { useSocialConnections } from '@/hooks/useSocialConnections';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

/** ISO-tijdstip naar de waarden van <input type="date"> en <input type="time">, in lokale tijd. */
function toLocalParts(iso: string | null): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date();
  return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') };
}

export default function SocialPlanner() {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const { weeks, pendingCount, isLoading, approve, update, remove, markPosted, chooseOwnMusic, requestRegenerate, saveImageText } = useSocialPlanner();
  const { connections } = useSocialConnections();

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

  const hasConnection = useMemo(
    () => connections.some((c) => c.is_active && (c.platform === 'instagram' || c.platform === 'facebook')),
    [connections],
  );

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
      />

      {!isLoading && !hasConnection && (
        <Alert>
          <Link2 className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <span>{t('admin.socialPlanner.noConnection')}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/connect?tab=channels">{t('admin.socialPlanner.toConnect')}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {pendingCount > 0 && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          {t('admin.socialPlanner.waiting', { count: pendingCount })}
        </p>
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
          const start = new Date(week.weekStart);
          const weekBusy = busyId === `week:${week.pendingIds.join(',')}`;
          return (
            <section key={week.weekStart} className="space-y-3">
              <div className="py-2 flex flex-wrap items-center justify-between gap-2 border-b">
                <h2 className="text-base font-semibold">
                  {t('admin.socialPlanner.week', {
                    from: format(start, 'd MMM', { locale }),
                    to: format(addDays(start, 6), 'd MMM', { locale }),
                  })}
                </h2>
                {week.pendingIds.length > 0 && (
                  <GatedButton
                    action="write"
                    resource="marketing"
                    size="sm"
                    onClick={() => handleApprove(week.pendingIds, true)}
                    disabled={weekBusy}
                  >
                    {weekBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-1" />}
                    {t('admin.socialPlanner.approveWeek', { count: week.pendingIds.length })}
                  </GatedButton>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

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
