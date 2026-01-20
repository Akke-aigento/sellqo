import { Languages, Check, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTenant } from '@/hooks/useTenant';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '@/types/translation';

interface TranslationStatusBadgeProps {
  entityType: 'product' | 'category';
  entityId?: string;
  /** If provided, shows translation status for these languages */
  translations?: {
    [lang in TranslationLanguage]?: {
      hasTranslation: boolean;
      isOutdated?: boolean;
    };
  };
  /** Show compact version (just flags) */
  compact?: boolean;
  /** Show "Quick Translate" button */
  showQuickAction?: boolean;
  onQuickTranslate?: () => void;
  isTranslating?: boolean;
}

export function TranslationStatusBadge({
  entityType,
  entityId,
  translations,
  compact = false,
  showQuickAction = false,
  onQuickTranslate,
  isTranslating,
}: TranslationStatusBadgeProps) {
  const { currentTenant } = useTenant();
  const sourceLang = (currentTenant as any)?.language || 'nl';

  // Target languages = all except source
  const targetLanguages = TRANSLATION_LANGUAGES.filter(l => l.code !== sourceLang);

  // Build status for each target language
  const languageStatuses = targetLanguages.map(lang => {
    const status = translations?.[lang.code];
    return {
      ...lang,
      hasTranslation: status?.hasTranslation ?? false,
      isOutdated: status?.isOutdated ?? false,
    };
  });

  const translatedCount = languageStatuses.filter(l => l.hasTranslation && !l.isOutdated).length;
  const outdatedCount = languageStatuses.filter(l => l.isOutdated).length;
  const missingCount = languageStatuses.filter(l => !l.hasTranslation).length;

  const allTranslated = translatedCount === targetLanguages.length && outdatedCount === 0;
  const hasIssues = outdatedCount > 0 || missingCount > 0;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {languageStatuses.map(lang => (
            <Tooltip key={lang.code}>
              <TooltipTrigger asChild>
                <span className="cursor-default text-sm">
                  {lang.hasTranslation ? (
                    lang.isOutdated ? (
                      <span className="opacity-50">{lang.flag}</span>
                    ) : (
                      <span>{lang.flag}</span>
                    )
                  ) : (
                    <span className="opacity-20">{lang.flag}</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {lang.label}:{' '}
                  {lang.hasTranslation
                    ? lang.isOutdated
                      ? 'Verouderd'
                      : 'Vertaald'
                    : 'Niet vertaald'}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Vertalingen</span>
      </div>

      <div className="flex items-center gap-1">
        {languageStatuses.map(lang => (
          <TooltipProvider key={lang.code}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={
                    lang.hasTranslation
                      ? lang.isOutdated
                        ? 'secondary'
                        : 'default'
                      : 'outline'
                  }
                  className="gap-1 cursor-default"
                >
                  <span>{lang.flag}</span>
                  {lang.hasTranslation ? (
                    lang.isOutdated ? (
                      <Clock className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {lang.label}:{' '}
                  {lang.hasTranslation
                    ? lang.isOutdated
                      ? 'Verouderd - bron is gewijzigd'
                      : 'Vertaald ✓'
                    : 'Niet vertaald'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      <div className="flex-1" />

      {showQuickAction && onQuickTranslate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onQuickTranslate}
          disabled={isTranslating || allTranslated}
        >
          {isTranslating ? (
            <>
              <Clock className="h-3 w-3 mr-1 animate-spin" />
              Vertalen...
            </>
          ) : allTranslated ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Volledig
            </>
          ) : (
            <>
              <Languages className="h-3 w-3 mr-1" />
              Vertalen
            </>
          )}
        </Button>
      )}

      {entityId && (
        <Link to="/admin/marketing/translations">
          <Button type="button" variant="ghost" size="sm">
            <ExternalLink className="h-3 w-3 mr-1" />
            Hub
          </Button>
        </Link>
      )}
    </div>
  );
}

// Compact inline version for use in table rows or lists
export function TranslationStatusInline({
  sourceLang = 'nl',
  translations,
}: {
  sourceLang?: TranslationLanguage;
  translations?: {
    [lang in TranslationLanguage]?: boolean;
  };
}) {
  const targetLanguages = TRANSLATION_LANGUAGES.filter(l => l.code !== sourceLang);

  return (
    <div className="flex items-center gap-0.5">
      {targetLanguages.map(lang => {
        const hasTranslation = translations?.[lang.code] ?? false;
        return (
          <span
            key={lang.code}
            className={`text-xs ${hasTranslation ? '' : 'opacity-30'}`}
            title={`${lang.label}: ${hasTranslation ? 'Vertaald' : 'Niet vertaald'}`}
          >
            {lang.flag}
          </span>
        );
      })}
    </div>
  );
}
