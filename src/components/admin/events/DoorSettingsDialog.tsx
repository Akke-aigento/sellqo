// EVENT-SCAN-2 — "Deur": de vaste deurlink van de winkel plus het scanvenster.
// De vaste link hangt niet aan een datum: het ticket wijst het event aan en het
// venster bewaakt dat het nú klopt. Eén beginscherm-icoon, voor altijd.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { Check, Copy, DoorOpen, ExternalLink, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { scannerUrl } from '@/hooks/useEventScannerAccess';
import {
  DEFAULT_SCAN_WINDOW, useCreateDoorLink, useDoorLinks, useSaveScanWindow, useScanWindow, useToggleDoorLink,
} from '@/hooks/useDoor';

export function DoorSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`door.settings.${x}`, o);
  const { data: links, isLoading } = useDoorLinks();
  const create = useCreateDoorLink();
  const toggle = useToggleDoorLink();
  const { data: win } = useScanWindow();
  const save = useSaveScanWindow();

  const [name, setName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [before, setBefore] = useState('60');
  const [after, setAfter] = useState('60');
  const [fallback, setFallback] = useState('6');

  useEffect(() => {
    const w = win ?? DEFAULT_SCAN_WINDOW;
    setBefore(String(w.open_before_minutes));
    setAfter(String(w.close_after_minutes));
    setFallback(String(w.no_end_fallback_hours));
  }, [win]);

  const add = async () => {
    try {
      await create.mutateAsync(name.trim() || k('default_name'));
      setName('');
      toast.success(k('created'));
    } catch { toast.error(k('create_failed')); }
  };

  const copy = async (url: string, id: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(id); window.setTimeout(() => setCopied(null), 2000); } catch { /* geen klembord */ }
  };

  const saveWindow = async () => {
    const b = parseInt(before, 10); const a = parseInt(after, 10); const f = parseInt(fallback, 10);
    if (![b, a].every((n) => Number.isInteger(n) && n >= 0 && n <= 10080) || !Number.isInteger(f) || f < 1 || f > 168) {
      toast.error(k('window_invalid')); return;
    }
    try {
      await save.mutateAsync({ open_before_minutes: b, close_after_minutes: a, no_end_fallback_hours: f });
      toast.success(k('window_saved'));
    } catch { toast.error(k('save_failed')); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DoorOpen className="h-5 w-5" />{k('title')}</DialogTitle>
          <DialogDescription>{k('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <p className="text-sm font-semibold">{k('links_title')}</p>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
              <>
                {(links ?? []).map((l) => (
                  <div key={l.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{k('uses', { count: l.use_count })}</p>
                      </div>
                      <Switch checked={l.is_active} onCheckedChange={(v) => toggle.mutate({ id: l.id, is_active: v })} aria-label={k('active')} />
                    </div>
                    {l.is_active && (
                      <>
                        <div className="flex justify-center rounded-lg bg-white p-3"><QRCode value={scannerUrl(l.access_token)} size={150} /></div>
                        <p className="break-all rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">{scannerUrl(l.access_token)}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" asChild>
                            <a href={scannerUrl(l.access_token)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />{k('open')}</a>
                          </Button>
                          <Button size="sm" className="flex-1" onClick={() => void copy(scannerUrl(l.access_token), l.id)}>
                            {copied === l.id ? <><Check className="mr-1 h-4 w-4" />{k('copied')}</> : <><Copy className="mr-1 h-4 w-4" />{k('copy')}</>}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{k('homescreen_hint')}</p>
                      </>
                    )}
                  </div>
                ))}
                {(links ?? []).length === 0 && <p className="text-sm text-muted-foreground">{k('no_links')}</p>}
                <div className="flex gap-2">
                  <Input value={name} placeholder={k('name_placeholder')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
                  <Button disabled={create.isPending} onClick={() => void add()}><Plus className="mr-1 h-4 w-4" />{k('add')}</Button>
                </div>
              </>
            )}
          </section>

          <section className="space-y-3 border-t pt-4">
            <p className="text-sm font-semibold">{k('window_title')}</p>
            <p className="text-xs text-muted-foreground">{k('window_hint')}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="win-before" className="text-xs">{k('window_before')}</Label>
                <Input id="win-before" inputMode="numeric" value={before} onChange={(e) => setBefore(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="win-after" className="text-xs">{k('window_after')}</Label>
                <Input id="win-after" inputMode="numeric" value={after} onChange={(e) => setAfter(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="win-fallback" className="text-xs">{k('window_fallback')}</Label>
                <Input id="win-fallback" inputMode="numeric" value={fallback} onChange={(e) => setFallback(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            <Button size="sm" disabled={save.isPending} onClick={() => void saveWindow()}>
              {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('window_save')}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
