import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, Pencil, ImagePlus, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { useAIImages } from '@/hooks/useAIImages';
import { useSocialPosts } from '@/hooks/useSocialConnections';
import type { MenuCard } from '@/types/daily-menu';

/** Wat een beeld kost. Spiegelt de creditCost in ai-generate-image. */
const IMAGE_CREDITS = 5;

interface MenuCardActionsProps {
  card: MenuCard;
  onUpdate: (args: { card: MenuCard; title: string; caption: string; hashtags: string[] }) => Promise<unknown>;
  onDiscard: (card: MenuCard) => Promise<unknown>;
  onAttachImage: (args: { card: MenuCard; imageUrl: string }) => Promise<unknown>;
  onMarkUsed: (card: MenuCard) => Promise<unknown>;
}

/**
 * Bepaalt de beeldverhouding uit het kaartformaat. `ai-generate-image` kent de
 * afmetingen per preset (instagram_story is 1080x1920, instagram_post 1080x1080),
 * dus we hoeven hier alleen de juiste preset te kiezen.
 */
function platformPresetFor(format: string): 'instagram_story' | 'instagram_post' {
  return format === 'story' || format === 'reel' ? 'instagram_story' : 'instagram_post';
}

export function MenuCardActions({
  card,
  onUpdate,
  onDiscard,
  onAttachImage,
  onMarkUsed,
}: MenuCardActionsProps) {
  const { t } = useTranslation();
  const { generateImage } = useAIImages();
  const { createPost } = useSocialPosts();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title ?? '');
  const [caption, setCaption] = useState(card.content_text ?? '');
  const [hashtags, setHashtags] = useState<string[]>(card.metadata?.hashtags ?? []);
  const [isBusy, setIsBusy] = useState(false);

  const hasImage = !!(card.metadata?.image_url ?? card.image_urls?.[0]);
  const canGenerateImage = !!card.metadata?.image_prompt && !hasImage;

  const handleSave = async () => {
    if (!caption.trim()) return;
    setIsBusy(true);
    try {
      await onUpdate({ card, title: title.trim(), caption: caption.trim(), hashtags });
      setIsEditing(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!card.metadata?.image_prompt) return;
    setIsBusy(true);
    try {
      const result = await generateImage.mutateAsync({
        prompt: card.metadata.image_prompt,
        style: 'realistic',
        platformPreset: platformPresetFor(card.metadata.card_format),
        sourceProductId: card.product_ids?.[0],
      });
      if (result?.imageUrl) {
        await onAttachImage({ card, imageUrl: result.imageUrl });
      }
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * Kiezen zet de kaart als concept klaar in `social_posts`. De caption en de
   * hashtags worden samengevoegd tot de posttekst, want dat is wat er
   * uiteindelijk gepubliceerd wordt.
   */
  const handleChoose = async () => {
    setIsBusy(true);
    try {
      const tags = card.metadata?.hashtags ?? [];
      const imageUrl = card.metadata?.image_url ?? card.image_urls?.[0];
      await createPost.mutateAsync({
        platform: card.platform ?? 'instagram',
        post_text: tags.length ? `${card.content_text ?? ''}\n\n${tags.join(' ')}` : (card.content_text ?? ''),
        image_urls: imageUrl ? [imageUrl] : [],
        status: 'draft',
        content_id: card.id,
      });
      await onMarkUsed(card);
    } finally {
      setIsBusy(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-3 border-t pt-3">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${card.id}`}>{t('content_menu.today.edit.title')}</Label>
          <Input
            id={`title-${card.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`caption-${card.id}`}>{t('content_menu.today.edit.caption')}</Label>
          <Textarea
            id={`caption-${card.id}`}
            rows={6}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('content_menu.today.edit.hashtags')}</Label>
          <TagInput
            values={hashtags}
            onChange={setHashtags}
            placeholder={t('content_menu.today.edit.hashtags_placeholder')}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(false);
              setTitle(card.title ?? '');
              setCaption(card.content_text ?? '');
              setHashtags(card.metadata?.hashtags ?? []);
            }}
          >
            <X className="h-4 w-4 mr-1" />
            {t('content_menu.actions.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!caption.trim() || isBusy}>
            <Check className="h-4 w-4 mr-1" />
            {t('content_menu.actions.save')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <Button size="sm" onClick={handleChoose} disabled={isBusy || !!card.is_used}>
        <Check className="h-4 w-4 mr-1" />
        {card.is_used ? t('content_menu.today.actions.chosen') : t('content_menu.today.actions.choose')}
      </Button>

      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={isBusy}>
        <Pencil className="h-4 w-4 mr-1" />
        {t('content_menu.today.actions.edit')}
      </Button>

      {canGenerateImage && (
        <Button variant="outline" size="sm" onClick={handleGenerateImage} disabled={isBusy}>
          {isBusy ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-1" />
          )}
          {t('content_menu.today.actions.generate_image', { credits: IMAGE_CREDITS })}
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-destructive ml-auto"
        onClick={() => onDiscard(card)}
        disabled={isBusy}
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {t('content_menu.today.actions.discard')}
      </Button>
    </div>
  );
}
