// SOCIAL-2 — één post in de Social planning: beeld, tijdstip, status, tekst en acties.
// Mobiel eerst: één kolom, beeld bovenaan in 4:5 zoals op Instagram.
// SOCIAL-3: reels (videovoorbeeld, muziekvoorstel, keuze automatisch of zelf muziek,
// video downloaden, caption kopiëren) en "Opnieuw maken".

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  AlertTriangle, Check, CheckCircle2, Clock, Copy, Download, Eye, Facebook, Images,
  Instagram, Languages, Linkedin, Loader2, Music, Pencil, RefreshCw, Trash2, Twitter, Type,
} from 'lucide-react';
import { downloadMedia, mediaFileName } from '@/lib/social/download';
import { mediaBaseName, type MediaItem } from '@/lib/social/media';
import { editableImageIndexes } from '@/lib/social/imageRecipe';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/permissions/GatedButton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { cn } from '@/lib/utils';
import { canAutoApprove, canRegenerate, type PlannerPost, type PlannerStatus } from '@/hooks/useSocialPlanner';

const PLATFORM_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
};

const PLATFORM_NAME: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X',
};

const STATUS_CLASS: Record<PlannerStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  publishing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  posted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  manual: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  regenerate_requested: 'bg-muted text-muted-foreground',
};

interface Props {
  post: PlannerPost;
  busy: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMarkPosted: () => void;
  onChooseOwnMusic: () => void;
  onRegenerate: () => void;
  onEditImageText: () => void;
  onViewMedia: () => void;
  onTranslate: () => void;
  media: MediaItem[];
}

export function SocialPlannerCard({
  post, busy, onApprove, onEdit, onRemove, onMarkPosted, onChooseOwnMusic, onRegenerate, onEditImageText,
  onViewMedia, onTranslate, media,
}: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const [expanded, setExpanded] = useState(false);

  const Icon = PLATFORM_ICON[post.platform] ?? Instagram;
  const images = post.image_urls ?? [];
  const when = post.scheduled_for ? new Date(post.scheduled_for) : null;
  const isPast = !!when && when.getTime() < Date.now();
  const isReel = post.media_type === 'reel';
  const waiting = post.status === 'pending_approval' || post.status === 'draft';
  const canApprove = canAutoApprove(post);
  // Een reel met stille versie: zelf muziek kiezen in de Instagram-app.
  const canOwnMusic = isReel && !!post.video_silent_url
    && ['pending_approval', 'draft', 'approved', 'scheduled'].includes(post.status);
  const canEdit = ['pending_approval', 'draft', 'approved', 'scheduled', 'failed'].includes(post.status);
  const canRemove = post.status !== 'posted' && post.status !== 'publishing';
  const longText = (post.post_text ?? '').length > 220;
  const video = isReel ? (post.status === 'manual' ? post.video_silent_url ?? post.video_url : post.video_url ?? post.video_silent_url) : null;
  const hint = post.music_hint;
  // SOCIAL-4: enkel waar een recept met tekstvakken bestaat; anders zou de knop niets doen.
  const canEditImageText = !isReel
    && !['posted', 'publishing', 'regenerate_requested'].includes(post.status)
    && editableImageIndexes(post).length > 0;

  // SOCIAL-4b: taal veranderen kan zolang de post niet online staat (geen tekst = niets te vertalen).
  const canTranslate = !['posted', 'publishing', 'regenerate_requested'].includes(post.status)
    && (!!post.post_text?.trim() || editableImageIndexes(post).length > 0 || (isReel && post.source === 'content_task'));
  const [downloading, setDownloading] = useState(false);
  const downloadAll = async () => {
    if (media.length !== 1) {
      onViewMedia();
      return;
    }
    setDownloading(true);
    try {
      await downloadMedia(media[0].url, mediaFileName(media[0].url, mediaBaseName(post), 0));
    } finally {
      setDownloading(false);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(post.post_text ?? '');
      toast.success(t('admin.socialPlanner.toast.captionCopied'));
    } catch {
      toast.error(t('admin.socialPlanner.toast.copyFailed'));
    }
  };

  return (
    <Card className="overflow-hidden">
      {isReel && video ? (
        <div className="relative bg-black aspect-[4/5]">
          <video
            src={video}
            poster={images[0]}
            controls
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-contain"
          />
          <Badge className="absolute top-2 left-2 bg-black/70 text-white hover:bg-black/70">
            {t('admin.socialPlanner.reel')}
          </Badge>
        </div>
      ) : images.length > 0 && (
        <div className="relative bg-muted aspect-[4/5]">
          <img
            src={images[0]}
            alt=""
            loading="lazy"
            className={cn(
              'absolute inset-0 h-full w-full',
              // Een story is 9:16: volledig tonen in plaats van bijsnijden.
              post.media_type === 'story' ? 'object-contain' : 'object-cover',
            )}
          />
          {images.length > 1 && (
            <Badge className="absolute top-2 right-2 bg-black/70 text-white hover:bg-black/70">
              <Images className="h-3 w-3 mr-1" />
              {t('admin.socialPlanner.carousel', { count: images.length })}
            </Badge>
          )}
          {post.media_type === 'story' && (
            <Badge className="absolute top-2 left-2 bg-black/70 text-white hover:bg-black/70">
              {t('admin.socialPlanner.story')}
            </Badge>
          )}
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {media.length > 0 && (
          <div className="flex gap-2 -mt-1">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onViewMedia}>
              <Eye className="h-4 w-4 mr-1" />
              {media.length > 1 ? t('admin.socialPlanner.media.viewAll', { count: media.length }) : t('admin.socialPlanner.media.view')}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={downloadAll} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              {t('admin.socialPlanner.media.download')}
            </Button>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {PLATFORM_NAME[post.platform] ?? post.platform}
                {post.language && (
                  <span className="ml-1.5 rounded border px-1 py-px text-[10px] font-semibold uppercase text-muted-foreground align-middle">
                    {post.language}
                  </span>
                )}
              </p>
              {when && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(when, 'EEE d MMM · HH:mm', { locale })}
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className={cn('shrink-0 text-xs', STATUS_CLASS[post.status] ?? STATUS_CLASS.draft)}>
            {t(`admin.socialPlanner.status.${post.status}`)}
          </Badge>
        </div>

        {post.post_text && (
          <div>
            <p className={cn('text-sm whitespace-pre-wrap break-words', !expanded && 'line-clamp-4')}>
              {post.post_text}
            </p>
            {longText && (
              <button
                type="button"
                className="text-xs text-primary mt-1"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? t('admin.socialPlanner.showLess') : t('admin.socialPlanner.showMore')}
              </button>
            )}
          </div>
        )}

        {isReel && hint && (hint.songs?.length || hint.mood || hint.search_terms?.length || hint.tip || hint.track?.title) && (
          <div className="rounded-md border p-3 space-y-1 text-xs">
            <p className="font-medium flex items-center gap-1">
              <Music className="h-3.5 w-3.5" />
              {t('admin.socialPlanner.music.title')}
            </p>
            {post.status !== 'manual' && hint.track?.title && (
              <p>{t('admin.socialPlanner.music.track', { title: hint.track.title })}</p>
            )}
            {post.status !== 'posted' && !!hint.songs?.length && (
              <div>
                <p>{t('admin.socialPlanner.music.songs')}</p>
                <ul className="list-disc pl-4">
                  {hint.songs.map((song, i) => (
                    <li key={i}>
                      <span className="font-medium">{song.title}</span>
                      {song.artist ? ` · ${song.artist}` : ''}
                      {song.note ? <span className="text-muted-foreground"> · {song.note}</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">{t('admin.socialPlanner.music.checkInApp')}</p>
              </div>
            )}
            {hint.mood && (
              <p>{t('admin.socialPlanner.music.mood', { mood: hint.mood })}{hint.bpm ? ` · ${hint.bpm} BPM` : ''}</p>
            )}
            {!!hint.search_terms?.length && (
              <p>{t('admin.socialPlanner.music.search', { terms: hint.search_terms.join(', ') })}</p>
            )}
            {hint.tip && <p className="text-muted-foreground">{hint.tip}</p>}
          </div>
        )}

        {post.status === 'regenerate_requested' && (
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <RefreshCw className="h-3 w-3 mt-0.5 shrink-0" />
            {post.regenerate_note
              ? t('admin.socialPlanner.regenerate.pendingWithNote', { note: post.regenerate_note })
              : t('admin.socialPlanner.regenerate.pending')}
          </p>
        )}

        {waiting && isPast && (
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1">
            <Clock className="h-3 w-3 mt-0.5 shrink-0" />
            {t('admin.socialPlanner.pastDue')}
          </p>
        )}

        {post.status === 'failed' && post.error_message && (
          <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1 break-words">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {post.error_message}
          </p>
        )}

        {post.status === 'manual' && (
          <p className="text-xs text-muted-foreground">
            {isReel ? t('admin.socialPlanner.manualReelHint') : t('admin.socialPlanner.manualHint')}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {canApprove && (
            <GatedButton action="write" resource="marketing" size="sm" className={cn('flex-1 min-w-[8rem]', isReel && 'basis-full')} onClick={onApprove} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {isReel ? t('admin.socialPlanner.approveAuto') : t('admin.socialPlanner.approve')}
            </GatedButton>
          )}
          {canOwnMusic && (
            <GatedButton action="write" resource="marketing" variant="outline" size="sm" className="flex-1 min-w-[8rem] basis-full" onClick={onChooseOwnMusic} disabled={busy}>
              <Music className="h-4 w-4 mr-1" />
              {t('admin.socialPlanner.ownMusic')}
            </GatedButton>
          )}
          {post.status === 'manual' && isReel && (
            <>
              {post.post_text && (
                <Button variant="outline" size="sm" className="flex-1 min-w-[8rem]" onClick={copyCaption}>
                  <Copy className="h-4 w-4 mr-1" />
                  {t('admin.socialPlanner.copyCaption')}
                </Button>
              )}
              <GatedButton action="write" resource="marketing" size="sm" className="flex-1 min-w-[8rem]" onClick={onMarkPosted} disabled={busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {t('admin.socialPlanner.markPosted')}
              </GatedButton>
            </>
          )}
          {post.status === 'manual' && !isReel && (
            <>
              <GatedButton action="write" resource="marketing" size="sm" className="flex-1 min-w-[8rem]" onClick={onMarkPosted} disabled={busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {t('admin.socialPlanner.markPosted')}
              </GatedButton>
            </>
          )}
          {canEdit && (
            <GatedButton action="write" resource="marketing" variant="outline" size="sm" onClick={onEdit} disabled={busy}>
              <Pencil className="h-4 w-4 mr-1" />
              {post.status === 'failed' ? t('admin.socialPlanner.reschedule') : t('admin.socialPlanner.edit')}
            </GatedButton>
          )}
          {canEditImageText && (
            <GatedButton action="write" resource="marketing" variant="outline" size="sm" onClick={onEditImageText} disabled={busy}>
              <Type className="h-4 w-4 mr-1" />
              {t('admin.socialPlanner.imageText.button')}
            </GatedButton>
          )}
          {canTranslate && (
            <GatedButton action="write" resource="marketing" variant="outline" size="sm" onClick={onTranslate} disabled={busy}>
              <Languages className="h-4 w-4 mr-1" />
              {t('admin.socialPlanner.translate.button')}
            </GatedButton>
          )}
          {canRegenerate(post) && (
            <GatedButton action="write" resource="marketing" variant="outline" size="sm" onClick={onRegenerate} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('admin.socialPlanner.regenerate.button')}
            </GatedButton>
          )}
          {canRemove && (
            <GatedButton
              action="write"
              resource="marketing"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
              disabled={busy}
              aria-label={t('admin.socialPlanner.remove')}
            >
              <Trash2 className="h-4 w-4" />
            </GatedButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
