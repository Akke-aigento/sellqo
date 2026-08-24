import { useTranslation } from 'react-i18next';
import { Play, ImageIcon, Sparkles, Heart, MessageCircle, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MenuCard } from '@/types/daily-menu';

interface MenuCardPreviewProps {
  card: MenuCard;
  categoryLabel: string;
}

/** Het beeldvlak. Toont het gegenereerde beeld, of een lege plaats met uitleg. */
function ImageSurface({
  card,
  className,
  children,
}: {
  card: MenuCard;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const imageUrl = card.metadata?.image_url ?? card.image_urls?.[0];

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-md bg-muted flex items-center justify-center',
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={card.title ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center gap-1.5 p-4 text-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t('content_menu.today.preview.no_image')}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Rendert een kaart zoals hij op het kanaal zou landen. Bewust vier verschillende
 * vormen: een story is staand met tekst over het beeld, een post is vierkant met
 * de caption eronder. Zo zie je meteen of een tekst te lang is voor het formaat
 * dat de AI koos.
 */
export function MenuCardPreview({ card, categoryLabel }: MenuCardPreviewProps) {
  const { t } = useTranslation();
  const format = card.metadata?.card_format ?? 'post';
  const caption = card.content_text ?? '';
  const hashtags = card.metadata?.hashtags ?? [];

  const header = (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      <Badge variant="secondary" className="text-[10px]">
        {categoryLabel}
      </Badge>
      <Badge variant="outline" className="text-[10px]">
        {t(`content_menu.today.formats.${format}`)}
      </Badge>
      {card.metadata?.is_freeform && (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Sparkles className="h-3 w-3" />
          {t('content_menu.today.preview.freeform')}
        </Badge>
      )}
      {card.platform && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {card.platform}
        </span>
      )}
    </div>
  );

  const footer = (
    <div className="mt-2 space-y-2">
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hashtags.map((tag) => (
            <span key={tag} className="text-[11px] text-primary">
              {tag}
            </span>
          ))}
        </div>
      )}
      {card.metadata?.angle_reason && (
        <p className="text-xs text-muted-foreground italic">
          {t('content_menu.today.preview.angle', { reason: card.metadata.angle_reason })}
        </p>
      )}
      {card.metadata?.format_reason && (
        <p className="text-xs text-muted-foreground">{card.metadata.format_reason}</p>
      )}
    </div>
  );

  // Staand 9:16 met tekst over het beeld — story en reel.
  if (format === 'story' || format === 'reel') {
    return (
      <div>
        {header}
        <ImageSurface card={card} className="aspect-[9/16]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {format === 'reel' && (
            <div className="absolute top-3 right-3 rounded-full bg-black/50 p-1.5">
              <Play className="h-3.5 w-3.5 text-white" fill="currentColor" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-sm text-white line-clamp-6 whitespace-pre-line drop-shadow">
              {caption}
            </p>
          </div>
        </ImageSurface>
        {footer}
      </div>
    );
  }

  // Vierkant met paginastippen — carrousel.
  if (format === 'carousel') {
    return (
      <div>
        {header}
        <ImageSurface card={card} className="aspect-square">
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  i === 0 ? 'bg-white' : 'bg-white/50',
                )}
              />
            ))}
          </div>
        </ImageSurface>
        <p className="mt-2 text-sm whitespace-pre-line line-clamp-5">{caption}</p>
        {footer}
      </div>
    );
  }

  // Vierkant met caption eronder — de gewone post.
  return (
    <div>
      {header}
      <ImageSurface card={card} className="aspect-square" />
      <div className="flex items-center gap-3 mt-2 text-muted-foreground">
        <Heart className="h-4 w-4" />
        <MessageCircle className="h-4 w-4" />
        <Send className="h-4 w-4" />
      </div>
      <p className="mt-1.5 text-sm whitespace-pre-line line-clamp-6">{caption}</p>
      {footer}
    </div>
  );
}
