import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  variant?: 'inline' | 'compact';
}

const LANGS: Array<{ code: 'nl' | 'en' | 'fr' | 'de'; label: string; flag: string }> = [
  { code: 'nl', label: 'NL', flag: '🇳🇱' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
];

export function LandingLanguageSwitcher({ className, variant = 'inline' }: Props) {
  const { language, setLanguage } = useLanguage();
  const current = (language || 'nl').split('-')[0];

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {LANGS.map((lang, i) => (
        <span key={lang.code} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={cn(
              'hover:text-foreground transition-colors',
              current === lang.code && 'text-foreground font-semibold'
            )}
            aria-label={`Switch language to ${lang.label}`}
          >
            {variant === 'compact' ? lang.flag : `${lang.flag} ${lang.label}`}
          </button>
          {i < LANGS.length - 1 && <span aria-hidden="true">|</span>}
        </span>
      ))}
    </div>
  );
}