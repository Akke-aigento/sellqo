import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface GiftCardTemplateConfig {
  id: string;
  name: string;
  description: string;
  bgStyle: string;
  textColor: string;
  accentColor: string;
  borderStyle?: string;
}

export const giftCardTemplates: GiftCardTemplateConfig[] = [
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Donker met goudkleurige accenten',
    bgStyle: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
    textColor: 'text-amber-100',
    accentColor: 'text-amber-400',
    borderStyle: 'border-amber-500/30',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Strak wit, merkkleur accenten',
    bgStyle: 'bg-white',
    textColor: 'text-gray-800',
    accentColor: 'text-primary',
    borderStyle: 'border-gray-200',
  },
  {
    id: 'festive',
    name: 'Feestelijk',
    description: 'Warme kleuren, feestelijke sfeer',
    bgStyle: 'bg-gradient-to-br from-red-500 via-rose-500 to-orange-400',
    textColor: 'text-white',
    accentColor: 'text-yellow-200',
    borderStyle: 'border-red-300/30',
  },
  {
    id: 'botanical',
    name: 'Botanisch',
    description: 'Zachte groentinten, organisch',
    bgStyle: 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50',
    textColor: 'text-emerald-900',
    accentColor: 'text-emerald-600',
    borderStyle: 'border-emerald-200',
  },
  {
    id: 'minimal',
    name: 'Minimalistisch',
    description: 'Zwart-wit, typografisch',
    bgStyle: 'bg-white',
    textColor: 'text-gray-900',
    accentColor: 'text-gray-900',
    borderStyle: 'border-gray-900',
  },
  {
    id: 'gradient',
    name: 'Kleurrijk',
    description: 'Gradient op basis van merkkleur',
    bgStyle: 'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600',
    textColor: 'text-white',
    accentColor: 'text-purple-100',
    borderStyle: 'border-purple-300/30',
  },
];

export function getTemplateById(id: string | null | undefined): GiftCardTemplateConfig {
  return giftCardTemplates.find(t => t.id === id) || giftCardTemplates[0];
}

interface GiftCardTemplatePreviewProps {
  template: GiftCardTemplateConfig;
  selected?: boolean;
  onClick?: () => void;
  amount?: number;
  storeName?: string;
  compact?: boolean;
  brandColor?: string;
  logoUrl?: string;
}

export function GiftCardTemplatePreview({
  template,
  selected,
  onClick,
  amount,
  storeName = 'Uw winkel',
  compact = false,
  brandColor,
  logoUrl,
}: GiftCardTemplatePreviewProps) {
  const formatPrice = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);

  // For gradient template, override with brand color
  const bgOverride =
    template.id === 'gradient' && brandColor
      ? { background: `linear-gradient(135deg, ${brandColor}, ${adjustColor(brandColor, -30)})` }
      : template.id === 'modern' && brandColor
      ? {}
      : undefined;

  const accentOverride =
    (template.id === 'modern' || template.id === 'gradient') && brandColor
      ? { color: template.id === 'modern' ? brandColor : undefined }
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden border-2 transition-all text-left w-full',
        compact ? 'aspect-[3/2]' : 'aspect-[16/10]',
        selected
          ? 'border-primary ring-2 ring-primary/20 scale-[1.02]'
          : 'border-transparent hover:border-primary/30 hover:shadow-md',
        template.borderStyle
      )}
    >
      <div
        className={cn('absolute inset-0', template.bgStyle)}
        style={bgOverride}
      />
      <div className={cn('relative p-4 flex flex-col justify-between h-full', compact && 'p-3')}>
        <div>
          <p className={cn('text-[10px] uppercase tracking-widest opacity-70', template.textColor)}>
            Cadeaukaart
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className={cn(
                  'h-5 w-5 object-contain rounded-sm',
                  ['elegant', 'festive', 'gradient'].includes(template.id) && 'bg-white/20 p-0.5'
                )}
              />
            )}
            <p className={cn('font-medium text-xs opacity-80', template.textColor)}>
              {storeName}
            </p>
          </div>
        </div>
        <div>
          <p
            className={cn(
              'font-bold',
              compact ? 'text-xl' : 'text-2xl',
              template.accentColor
            )}
            style={accentOverride}
          >
            {amount ? formatPrice(amount) : '€ —'}
          </p>
          {!compact && (
            <p className={cn('text-[10px] mt-1 opacity-60', template.textColor)}>
              {template.name}
            </p>
          )}
        </div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
          <Check className="h-3 w-3" />
        </div>
      )}
    </button>
  );
}

interface GiftCardTemplateRendererProps {
  templateId: string | null | undefined;
  storeName: string;
  amount: number;
  recipientName?: string;
  personalMessage?: string;
  code?: string;
  expiryDate?: string;
  brandColor?: string;
  logoUrl?: string;
}

export function GiftCardTemplateRenderer({
  templateId,
  storeName,
  amount,
  recipientName,
  personalMessage,
  code,
  expiryDate,
  brandColor,
  logoUrl,
}: GiftCardTemplateRendererProps) {
  const template = getTemplateById(templateId);
  const formatPrice = (v: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);

  const bgOverride =
    template.id === 'gradient' && brandColor
      ? { background: `linear-gradient(135deg, ${brandColor}, ${adjustColor(brandColor, -30)})` }
      : undefined;

  return (
    <div
      className={cn('rounded-2xl overflow-hidden border shadow-lg max-w-md mx-auto', template.borderStyle)}
    >
      <div className={cn('p-8', template.bgStyle)} style={bgOverride}>
        <p className={cn('text-xs uppercase tracking-[0.2em] opacity-70 mb-1', template.textColor)}>
          Cadeaukaart
        </p>
        <div className="flex items-center gap-3 mb-6">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className={cn(
                'h-10 w-10 object-contain rounded',
                ['elegant', 'festive', 'gradient'].includes(template.id) && 'bg-white/20 p-1'
              )}
            />
          )}
          <p className={cn('text-lg font-semibold', template.textColor)}>
            {storeName}
          </p>
        </div>
        <p className={cn('text-4xl font-bold mb-4', template.accentColor)}>
          {formatPrice(amount)}
        </p>
        {recipientName && (
          <p className={cn('text-sm mb-1', template.textColor)}>
            Voor: <span className="font-semibold">{recipientName}</span>
          </p>
        )}
        {personalMessage && (
          <p className={cn('text-sm italic opacity-80 mt-2 mb-4', template.textColor)}>
            "{personalMessage}"
          </p>
        )}
        {code && (
          <div className={cn('mt-6 pt-4 border-t border-current/10')}>
            <p className={cn('text-[10px] uppercase tracking-widest opacity-50 mb-1', template.textColor)}>
              Code
            </p>
            <p className={cn('text-lg font-mono font-bold tracking-wider', template.accentColor)}>
              {code}
            </p>
          </div>
        )}
        {expiryDate && (
          <p className={cn('text-[10px] mt-3 opacity-50', template.textColor)}>
            Geldig t/m {expiryDate}
          </p>
        )}
      </div>
    </div>
  );
}

/** Darken/lighten hex color by amount (-100 to 100) */
function adjustColor(hex: string, amount: number): string {
  try {
    let color = hex.replace('#', '');
    if (color.length === 3) color = color.split('').map(c => c + c).join('');
    const num = parseInt(color, 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  } catch {
    return hex;
  }
}

/**
 * Generate HTML email template for a gift card based on template ID.
 * Used in the edge function.
 */
export function getGiftCardEmailStyles(templateId: string | null | undefined, brandColor?: string) {
  const t = getTemplateById(templateId);
  
  const styles: Record<string, Record<string, string>> = {
    elegant: {
      bgColor: '#1a1a2e',
      textColor: '#fef3c7',
      accentColor: '#fbbf24',
      borderColor: '#78350f',
      cardBg: '#1e1e3a',
    },
    modern: {
      bgColor: '#f8fafc',
      textColor: '#1e293b',
      accentColor: brandColor || '#7c3aed',
      borderColor: '#e2e8f0',
      cardBg: '#ffffff',
    },
    festive: {
      bgColor: '#ef4444',
      textColor: '#ffffff',
      accentColor: '#fef08a',
      borderColor: '#fca5a5',
      cardBg: 'linear-gradient(135deg, #ef4444, #f97316)',
    },
    botanical: {
      bgColor: '#ecfdf5',
      textColor: '#064e3b',
      accentColor: '#059669',
      borderColor: '#a7f3d0',
      cardBg: '#f0fdf4',
    },
    minimal: {
      bgColor: '#ffffff',
      textColor: '#111827',
      accentColor: '#111827',
      borderColor: '#111827',
      cardBg: '#ffffff',
    },
    gradient: {
      bgColor: brandColor || '#8b5cf6',
      textColor: '#ffffff',
      accentColor: '#e9d5ff',
      borderColor: brandColor ? adjustColor(brandColor, -30) : '#7c3aed',
      cardBg: `linear-gradient(135deg, ${brandColor || '#8b5cf6'}, ${adjustColor(brandColor || '#8b5cf6', -40)})`,
    },
  };

  return styles[t.id] || styles.elegant;
}
