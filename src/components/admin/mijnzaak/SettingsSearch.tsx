// HORECA-INSTELLINGEN-1 — zoeken in de instellingen ("fooi", "printer", "pin", "terras" …).
// Twee plekken, één component: bovenaan Mijn zaak (inline) en in de ⌘K/Ctrl-K-dialoog (SettingsSearchDialog).
// Het register en de zoekregel staan in src/lib/settingsIndex.ts; hier enkel weergave en rechten.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useTracks } from '@/hooks/useBusinessModules';
import { useZaakAccess } from '@/hooks/useZaakAccess';
import { searchSettings, settingsIndexFor, type ResolvedEntry } from '@/lib/settingsIndex';
import { cn } from '@/lib/utils';

export function SettingsSearch({ inline = false, autoFocus = false, onPick }: {
  /** Inline: de resultaten verschijnen pas als je typt (bovenaan Mijn zaak). */
  inline?: boolean;
  autoFocus?: boolean;
  /** Na het kiezen (de dialoog sluit zich). */
  onPick?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasTrack } = useTracks();
  const canOpen = useZaakAccess();
  const [query, setQuery] = useState('');

  const entries = useMemo<ResolvedEntry[]>(() => settingsIndexFor(hasTrack)
    .filter((e) => canOpen(e.rule))
    .map((e) => ({
      ...e,
      label: t(e.labelKey),
      group: t(e.groupKey),
      synonyms: t(e.synKey).split(',').map((x) => x.trim()).filter(Boolean),
    })), [hasTrack, canOpen, t]);
  const results = useMemo(() => searchSettings(entries, query), [entries, query]);
  const showList = !inline || query.trim().length > 0;

  const pick = (e: ResolvedEntry) => {
    setQuery('');
    onPick?.();
    navigate(e.path);
  };

  return (
    <Command shouldFilter={false} className={cn(inline && 'rounded-lg border shadow-sm')} label={t('settingsSearch.label')}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t('settingsSearch.placeholder')} autoFocus={autoFocus} aria-label={t('settingsSearch.label')} />
      {showList ? (
        <CommandList className={cn(inline && 'max-h-80')}>
          <CommandEmpty>{t('settingsSearch.empty')}</CommandEmpty>
          {results.length > 0 ? (
            <CommandGroup heading={query.trim() ? t('settingsSearch.results') : t('settingsSearch.all')}>
              {results.map((e) => (
                <CommandItem key={e.id} value={e.id} onSelect={() => pick(e)} className="flex items-center gap-2" data-entry={e.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.group}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      ) : null}
    </Command>
  );
}
