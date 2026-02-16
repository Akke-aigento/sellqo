import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Language {
  code: string;
  name: string;
  flag: string;
}

const ALL_LANGUAGES: Language[] = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

interface StorefrontLanguageSelectorProps {
  languages: string[];
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  style: 'dropdown' | 'flags' | 'text';
}

export function StorefrontLanguageSelector({ languages, currentLanguage, onLanguageChange, style }: StorefrontLanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const availableLanguages = ALL_LANGUAGES.filter(l => languages.includes(l.code));
  const current = ALL_LANGUAGES.find(l => l.code === currentLanguage) || availableLanguages[0];

  // Don't show if only 1 language
  if (availableLanguages.length <= 1) return null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (style === 'flags') {
    return (
      <div className="flex items-center gap-1">
        {availableLanguages.map(lang => (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className={`text-lg px-1 py-0.5 rounded transition-opacity ${
              lang.code === currentLanguage ? 'opacity-100' : 'opacity-50 hover:opacity-80'
            }`}
            title={lang.name}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
  }

  if (style === 'text') {
    return (
      <div className="flex items-center gap-1 text-sm">
        {availableLanguages.map((lang, i) => (
          <span key={lang.code}>
            <button
              onClick={() => onLanguageChange(lang.code)}
              className={`hover:text-primary transition-colors ${
                lang.code === currentLanguage ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {lang.code.toUpperCase()}
            </button>
            {i < availableLanguages.length - 1 && <span className="text-muted-foreground mx-1">|</span>}
          </span>
        ))}
      </div>
    );
  }

  // Default: dropdown
  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-8 px-2"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base">{current?.flag}</span>
        <span className="text-xs hidden sm:inline">{current?.code.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3" />
      </Button>
      
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-50 min-w-[140px] py-1">
          {availableLanguages.map(lang => (
            <button
              key={lang.code}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                lang.code === currentLanguage ? 'font-medium bg-muted/50' : ''
              }`}
              onClick={() => { onLanguageChange(lang.code); setOpen(false); }}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
