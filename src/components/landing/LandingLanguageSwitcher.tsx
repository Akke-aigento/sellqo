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

interface Props {
  className?: string;
  variant?: 'inline' | 'compact';
}

const LANGUAGES: Array<{ code: 'nl' | 'en' | 'fr' | 'de'; endonym: string }> = [
  { code: 'nl', endonym: 'Nederlands' },
  { code: 'en', endonym: 'English' },
  { code: 'fr', endonym: 'Français' },
  { code: 'de', endonym: 'Deutsch' },
];

export function LandingLanguageSwitcher({ className, variant = 'inline' }: Props) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const current = (language || 'nl').split('-')[0];
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
