import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { moveCard, type CockpitCardId, type CockpitLayout } from './cockpitLayout';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: CockpitLayout;
  onSave: (order: CockpitCardId[], hidden: CockpitCardId[]) => void;
  onReset: () => void;
  saving: boolean;
}

/** DASH-2b — kaarten aan/uit en in een andere volgorde, per gebruiker. */
export function CockpitCustomizeDialog({ open, onOpenChange, layout, onSave, onReset, saving }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<CockpitCardId[]>([]);
  const [hidden, setHidden] = useState<Set<CockpitCardId>>(new Set());

  useEffect(() => {
    if (open) {
      setOrder(layout.order.map((c) => c.id));
      setHidden(new Set(layout.hidden));
    }
  }, [open, layout]);

  const toggle = (id: CockpitCardId, visible: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('admin.cockpit.customize.title')}
      description={t('admin.cockpit.customize.description')}
      maxWidth="md"
      footer={
        <div className="flex w-full justify-between gap-2">
          <Button variant="ghost" onClick={onReset} disabled={saving}>
            {t('admin.cockpit.customize.reset')}
          </Button>
          <Button onClick={() => onSave(order, [...hidden])} disabled={saving}>
            {t('admin.cockpit.customize.save')}
          </Button>
        </div>
      }
    >
      <ol className="flex flex-col divide-y">
        {order.map((id, i) => {
          const visible = !hidden.has(id);
          const label = t(`admin.cockpit.cards.${id}`);
          return (
            <li key={id} className="flex min-h-14 items-center gap-3 py-1.5">
              <Switch
                id={`cockpit-card-${id}`}
                checked={visible}
                onCheckedChange={(v) => toggle(id, v)}
                aria-label={t('admin.cockpit.customize.show', { card: label })}
              />
              <label htmlFor={`cockpit-card-${id}`} className={visible ? 'flex-1 text-sm font-semibold' : 'flex-1 text-sm font-semibold text-muted-foreground'}>
                {label}
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                disabled={i === 0}
                onClick={() => setOrder((o) => moveCard(o, id, -1))}
                aria-label={t('admin.cockpit.customize.up', { card: label })}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                disabled={i === order.length - 1}
                onClick={() => setOrder((o) => moveCard(o, id, 1))}
                aria-label={t('admin.cockpit.customize.down', { card: label })}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ol>
    </ResponsiveDialog>
  );
}
