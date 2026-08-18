import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SUPPORTED_LANGUAGES, DEFAULT_LANG, type LangCode } from '@/i18n/languages';

interface Props {
  className?: string;
  variant?: 'inline' | 'compact';
}

// label in SUPPORTED_LANGUAGES is het endonym (de taalnaam in de taal zelf).
const LANGUAGES: Array<{ code: LangCode; endonym: string }> =
  SUPPORTED_LANGUAGES.map(({ code, label }) => ({ code, endonym: label }));

export function LandingLanguageSwitcher({ className, variant = 'inline' }: Props) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const current = (language || DEFAULT_LANG).split('-')[0];
  const currentLang = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 px-2 font-normal',
            variant === 'compact' ? 'h-8 text-xs' : 'h-9 text-sm',
            className
          )}
          aria-label={t('landing.nav.languageSelect')}
        >
          <Globe className="h-4 w-4" />
          <span className={variant === 'compact' ? 'uppercase' : ''}>
            {variant === 'compact' ? currentLang.code : currentLang.endonym}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="cursor-pointer gap-2"
          >
            <Check
              className={cn('h-4 w-4', current !== lang.code && 'invisible')}
              aria-hidden="true"
            />
            <span>{lang.endonym}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
