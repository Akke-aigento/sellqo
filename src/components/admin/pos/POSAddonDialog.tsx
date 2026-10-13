// FOOD-2 — extra's kiezen bij het aanslaan in de kassa (toppings, saus, formaat).
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { addonSelectionError, chosenAddons, type AddonGroupLite, type ChosenAddon } from '@/lib/productAddons';

const euro = (n: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(n);

export function POSAddonDialog({ open, productName, basePrice, groups, onCancel, onConfirm }: {
  open: boolean; productName: string; basePrice: number; groups: AddonGroupLite[];
  onCancel: () => void; onConfirm: (addons: ChosenAddon[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setPicked([]); setTried(false); } }, [open]);

  const extra = chosenAddons(groups, picked).reduce((s, a) => s + a.price, 0);
  const error = addonSelectionError(groups, picked);
  const toggle = (g: AddonGroupLite, id: string) => {
    const inGroup = g.options.map((o) => o.id);
    if (g.max_select === 1) {
      const on = picked.includes(id);
      setPicked((p) => [...p.filter((x) => !inGroup.includes(x)), ...(on && g.min_select === 0 ? [] : [id])]);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{productName}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {groups.map((g) => {
            const n = g.options.filter((o) => picked.includes(o.id)).length;
            const full = g.max_select != null && g.max_select > 1 && n >= g.max_select;
            const bad = tried && !!addonSelectionError([g], picked);
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{g.name}</span>
                  <span className={cn('text-xs', bad ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                    {g.min_select > 0 ? `Verplicht${g.max_select === 1 ? ' · kies 1' : ''}` : g.max_select ? `Optioneel · max. ${g.max_select}` : 'Optioneel'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {g.options.map((o) => {
                    const on = picked.includes(o.id);
                    return (
                      <button key={o.id} type="button" aria-pressed={on} disabled={!on && full} onClick={() => toggle(g, o.id)}
                        className={cn('flex min-h-14 flex-col items-start justify-center rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-40',
                          on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted')}>
                        <span className="font-semibold leading-tight">{o.name}</span>
                        <span className="text-xs text-muted-foreground">{o.price > 0 ? `+ ${euro(o.price)}` : 'gratis'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {tried && error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>Annuleren</Button>
          <Button className="min-w-40" onClick={() => { setTried(true); if (!error) onConfirm(chosenAddons(groups, picked)); }}>
            Toevoegen · {euro(basePrice + extra)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
