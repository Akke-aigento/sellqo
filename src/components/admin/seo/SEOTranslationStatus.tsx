import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Globe, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '@/types/translation';

interface SEOTranslationStatusProps {
  entityId: string;
  entityType: 'product' | 'category';
  translations?: {
    [lang: string]: {
      meta_title?: boolean;
      meta_description?: boolean;
    };
  };
  onTranslate?: (entityId: string, lang: TranslationLanguage) => void;
  isTranslating?: boolean;
  compact?: boolean;
}

export function SEOTranslationStatus({
  entityId,
  entityType,
  translations = {},
  onTranslate,
  isTranslating,
  compact = false,
}: SEOTranslationStatusProps) {
  const targetLanguages = TRANSLATION_LANGUAGES.filter((l) => l.code !== 'nl');

  // Calculate coverage per language
  const languageStatus = targetLanguages.map((lang) => {
    const langTranslations = translations[lang.code];
    const hasMetaTitle = langTranslations?.meta_title ?? false;
    const hasMetaDescription = langTranslations?.meta_description ?? false;
    const complete = hasMetaTitle && hasMetaDescription;
    const partial = hasMetaTitle || hasMetaDescription;

    return {
      ...lang,
      complete,
      partial: partial && !complete,
      missing: !partial,
    };
  });

  const allComplete = languageStatus.every((l) => l.complete);
  const someComplete = languageStatus.some((l) => l.complete || l.partial);

  if (compact) {
    // Compact view for table cells
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {languageStatus.map((lang) => (
                <div
                  key={lang.code}
                  className={cn(
                    'w-2 h-2 rounded-full',
                    lang.complete && 'bg-green-500',
                    lang.partial && 'bg-yellow-500',
                    lang.missing && 'bg-muted'
                  )}
                />
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="p-3">
            <div className="space-y-2">
              <p className="font-medium text-sm">SEO Vertalingen</p>
              <div className="space-y-1">
                {languageStatus.map((lang) => (
                  <div key={lang.code} className="flex items-center gap-2 text-xs">
                    <span>{lang.flag}</span>
                    <span className="w-8">{lang.code.toUpperCase()}</span>
                    {lang.complete ? (
                      <Badge variant="default" className="bg-green-500 text-xs h-5">
                        <Check className="h-3 w-3 mr-1" />
                        Compleet
                      </Badge>
                    ) : lang.partial ? (
                      <Badge variant="secondary" className="text-xs h-5">
                        Deels
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs h-5">
                        Ontbreekt
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              {onTranslate && !allComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => {
                    const missingLang = languageStatus.find((l) => !l.complete);
                    if (missingLang) {
                      onTranslate(entityId, missingLang.code as TranslationLanguage);
                    }
                  }}
                  disabled={isTranslating}
                >
                  {isTranslating ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Globe className="h-3 w-3 mr-1" />
                  )}
                  Vertalen
                </Button>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        {languageStatus.map((lang) => (
          <Tooltip key={lang.code}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded border cursor-default',
                  lang.complete && 'bg-green-500/10 border-green-500/30 text-green-700',
                  lang.partial && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700',
                  lang.missing && 'bg-muted border-border text-muted-foreground'
                )}
              >
                <span className="text-sm">{lang.flag}</span>
                {lang.complete ? (
                  <Check className="h-3 w-3" />
                ) : lang.partial ? (
                  <AlertCircle className="h-3 w-3" />
                ) : null}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p className="font-medium">{lang.label}</p>
                <p>
                  Meta title: {translations[lang.code]?.meta_title ? '✓' : '✗'}
                </p>
                <p>
                  Meta description: {translations[lang.code]?.meta_description ? '✓' : '✗'}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
      
      {onTranslate && !allComplete && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => {
            const missingLang = languageStatus.find((l) => !l.complete);
            if (missingLang) {
              onTranslate(entityId, missingLang.code as TranslationLanguage);
            }
          }}
          disabled={isTranslating}
        >
          {isTranslating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Globe className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}
