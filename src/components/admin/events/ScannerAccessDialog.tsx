// EVENT-SYSTEEM FASE 4c — aanmaak-dialog voor een deur-toegang (scanner-token).
//
// Het token zit NIET in dit formulier: de DB genereert hem server-side bij de insert.
// Scoping: zone (verplicht in de DB — leeg = auto-hoofdingang), richting, scan-modus
// en optioneel een selectie tickettypes. Niets aangevinkt = alle tickettypes.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  SCAN_DIRECTIONS, SCAN_MODES,
  type ScanDirection, type ScanMode, type ScannerAccessFormData,
} from '@/hooks/useEventScannerAccess';

export interface ScannerZoneOption {
  id: string;
  name: string;
}

export interface ScannerTicketTypeOption {
  product_id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: ScannerZoneOption[];
  ticketTypes: ScannerTicketTypeOption[];
  saving: boolean;
  onSubmit: (form: ScannerAccessFormData) => void;
}

const AUTO_ZONE = '__auto__';

export function ScannerAccessDialog({
  open, onOpenChange, zones, ticketTypes, saving, onSubmit,
}: Props) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [zoneId, setZoneId] = useState<string>(AUTO_ZONE);
  const [direction, setDirection] = useState<ScanDirection>('in');
  const [scanMode, setScanMode] = useState<ScanMode>('check_in');
  const [scope, setScope] = useState<string[]>([]);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [expiryTime, setExpiryTime] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setZoneId(zones.length > 0 ? zones[0].id : AUTO_ZONE);
    setDirection('in');
    setScanMode('check_in');
    setScope([]);
    setExpiryDate(undefined);
    setExpiryTime('');
  }, [open, zones]);

  const toggleScope = (productId: string, checked: boolean) => {
    setScope((prev) =>
      checked ? [...new Set([...prev, productId])] : prev.filter((p) => p !== productId),
    );
  };

  const expiresAt = (() => {
    if (!expiryDate) return null;
    const [h, m] = (expiryTime || '23:59').split(':');
    const d = new Date(expiryDate);
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return d.toISOString();
  })();

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = () => {
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      zone_id: zoneId === AUTO_ZONE ? null : zoneId,
      direction,
      scan_mode: scanMode,
      allowed_product_ids: scope,
      expires_at: expiresAt,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('events.access.form.newTitle')}</DialogTitle>
          <DialogDescription>{t('events.access.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sa-name">{t('events.access.form.name')}</Label>
            <Input
              id="sa-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('events.access.form.namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('events.access.form.zone')}</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
                <SelectItem value={AUTO_ZONE}>{t('events.access.form.zoneAuto')}</SelectItem>
              </SelectContent>
            </Select>
            {zoneId === AUTO_ZONE && (
              <p className="text-xs text-muted-foreground">{t('events.access.form.zoneAutoHint')}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('events.access.form.direction')}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as ScanDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCAN_DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>{t(`events.access.direction.${d}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('events.access.form.scanMode')}</Label>
              <Select value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCAN_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{t(`events.access.scanMode.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('events.access.form.scope')}</Label>
            {ticketTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('events.access.form.scopeNoTypes')}</p>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                {ticketTypes.map((tt) => (
                  <div key={tt.product_id} className="flex items-center gap-2">
                    <Checkbox
                      id={`sa-scope-${tt.product_id}`}
                      checked={scope.includes(tt.product_id)}
                      onCheckedChange={(v) => toggleScope(tt.product_id, v === true)}
                    />
                    <Label htmlFor={`sa-scope-${tt.product_id}`} className="font-normal break-words">
                      {tt.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('events.access.form.scopeHint')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('events.access.form.expiresAt')}</Label>
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('flex-1 min-w-[8rem] justify-start font-normal', !expiryDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {expiryDate ? format(expiryDate, 'dd-MM-yyyy') : t('events.access.form.pickDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="w-[7.5rem]"
                disabled={!expiryDate}
              />
              {expiryDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { setExpiryDate(undefined); setExpiryTime(''); }}
                  aria-label={t('events.access.form.clear')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('events.access.form.expiresHint')}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('events.access.form.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('events.access.form.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
