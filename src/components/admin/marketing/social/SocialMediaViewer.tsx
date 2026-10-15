// SOCIAL-4b — alle beelden (en de video) van een post bekijken en elk apart downloaden.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { downloadMedia, mediaFileName } from '@/lib/social/download';
import { mediaBaseName, type MediaItem } from '@/lib/social/media';
import type { PlannerPost } from '@/hooks/useSocialPlanner';

interface Props {
  post: PlannerPost | null;
  items: MediaItem[];
  onClose: () => void;
}

export function SocialMediaViewer({ post, items, onClose }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<number | null>(null);

  const download = async (item: MediaItem, i: number) => {
    if (!post) return;
    setBusy(i);
    try {
      await downloadMedia(item.url, mediaFileName(item.url, mediaBaseName(post), i));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ResponsiveDialog
      open={!!post}
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.socialPlanner.media.title')}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {items.map((item, i) => (
          <figure key={`${item.url}-${i}`} className="space-y-2">
            <div className="rounded-md border bg-muted overflow-hidden">
              {item.kind === 'video' ? (
                <video src={item.url} controls playsInline preload="metadata" className="mx-auto max-h-[70vh] w-auto" />
              ) : (
                <img src={item.url} alt="" className="mx-auto max-h-[70vh] w-auto" />
              )}
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {t('admin.socialPlanner.media.open')}
                  </a>
                </Button>
                <Button size="sm" onClick={() => download(item, i)} disabled={busy === i}>
                  {busy === i ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  {t('admin.socialPlanner.media.download')}
                </Button>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </ResponsiveDialog>
  );
}
