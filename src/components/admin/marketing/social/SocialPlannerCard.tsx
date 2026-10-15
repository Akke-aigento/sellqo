// SOCIAL-2 — één post in de Social planning: beeld, tijdstip, status, tekst en acties.
// Mobiel eerst: één kolom, beeld bovenaan in 4:5 zoals op Instagram.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  AlertTriangle, Check, CheckCircle2, Clock, ExternalLink, Facebook, Images,
  Instagram, Linkedin, Loader2, Pencil, Trash2, Twitter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GatedButton } from '@/components/permissions/GatedButton';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { cn } from '@/lib/utils';
import type { PlannerPost, PlannerStatus } from '@/hooks/useSocialPlanner';

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
};

interface Props {
  post: PlannerPost;
  busy: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onMarkPosted: () => void;
}

export function SocialPlannerCard({ post, busy, onApprove, onEdit, onRemove, onMarkPosted }: Props) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const [expanded, setExpanded] = useState(false);

  const Icon = PLATFORM_ICON[post.platform] ?? Instagram;
  const images = post.image_urls ?? [];
  const when = post.scheduled_for ? new Date(post.scheduled_for) : null;
  const isPast = !!when && when.getTime() < Date.now();
  const canApprove = post.status === 'pending_approval' || post.status === 'draft';
  const canEdit = ['pending_approval', 'draft', 'approved', 'scheduled', 'failed'].includes(post.status);
  const canRemove = post.status !== 'posted' && post.status !== 'publishing';
  const longText = (post.post_text ?? '').length > 220;

  return (
    <Card className="overflow-hidden">
      {images.length > 0 && (
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
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{PLATFORM_NAME[post.platform] ?? post.platform}</p>
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

        {canApprove && isPast && (
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
          <p className="text-xs text-muted-foreground">{t('admin.socialPlanner.manualHint')}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {canApprove && (
            <GatedButton action="write" resource="marketing" size="sm" className="flex-1 min-w-[8rem]" onClick={onApprove} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {t('admin.socialPlanner.approve')}
            </GatedButton>
          )}
          {post.status === 'manual' && (
            <>
              {images[0] && (
                <Button variant="outline" size="sm" asChild className="flex-1 min-w-[8rem]">
                  <a href={images[0]} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {t('admin.socialPlanner.openImage')}
                  </a>
                </Button>
              )}
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
