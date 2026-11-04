// HORECA-INSTELLINGEN-1 — de zoekbalk overal in de admin: een zoekicoon in de kop (ook op de gsm) en
// ⌘K / Ctrl-K. Enkel voor zaken met een register (horeca-only, zie settingsIndexFor); anders niets.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTracks } from '@/hooks/useBusinessModules';
import { settingsIndexFor } from '@/lib/settingsIndex';
import { SettingsSearch } from './SettingsSearch';

export function SettingsSearchButton() {
  const { t } = useTranslation();
  const { hasTrack } = useTracks();
  const [open, setOpen] = useState(false);
  const enabled = settingsIndexFor(hasTrack).length > 0;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setOpen(true)} aria-label={t('settingsSearch.open')} title={t('settingsSearch.shortcut')}>
        <Search className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] translate-y-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">{t('settingsSearch.label')}</DialogTitle>
          <DialogDescription className="sr-only">{t('settingsSearch.shortcut')}</DialogDescription>
          <SettingsSearch autoFocus onPick={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
