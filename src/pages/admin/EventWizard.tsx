// EVENT-WIZARD-1 — "Nieuw event": wat, wanneer & waar, tickets, deur. Eén scherm, vier
// stappen, en aan het eind een event dat meteen te koop is (zie useCreateEvent).
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Copy, DoorOpen, ImagePlus, Loader2, MapPin, PartyPopper, Ticket, X,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useCreateEvent, type NewEventResult } from '@/hooks/useCreateEvent';
import { scannerUrl } from '@/hooks/useEventScannerAccess';
import { weeklyDates } from '@/lib/eventSeries';
import { toast } from 'sonner';

const STEPS = ['what', 'when', 'tickets', 'door'] as const;
type Step = (typeof STEPS)[number];

const todayIso = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export default function EventWizard() {
  const { t, i18n } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.wizard.${x}`, o);
  const navigate = useNavigate();
  const create = useCreateEvent();
  const { uploadImage, uploading } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('what');
  const [done, setDone] = useState<NewEventResult | null>(null);

  // Wat
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  // Wanneer & waar
  const [repeat, setRepeat] = useState(false);
  const [date, setDate] = useState('');
  const [weeks, setWeeks] = useState('6');
  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [meeting, setMeeting] = useState('');
  // Tickets
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [minAttendees, setMinAttendees] = useState('0');
  const [earlyBird, setEarlyBird] = useState(false);
  const [ebPrice, setEbPrice] = useState('');
  const [ebQty, setEbQty] = useState('');
  // Deur
  const [scanner, setScanner] = useState(true);
  const [scannerName, setScannerName] = useState('Deur');

  const dates = useMemo(() => (date ? (repeat ? weeklyDates(date, Number(weeks)) : [date]) : []), [date, repeat, weeks]);
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const priceN = num(price);
  const capN = num(capacity);
  const ebPriceN = num(ebPrice);
  const ebQtyN = num(ebQty);
  const errors: Record<Step, string | null> = {
    what: name.trim().length < 2 ? k('err_name') : null,
    when: !date ? k('err_date') : date < todayIso() ? k('err_past') : !startTime ? k('err_time') : null,
    tickets: priceN === null || !Number.isFinite(priceN) || priceN < 0 ? k('err_price')
      : capN === null || !Number.isInteger(capN) || capN < 1 ? k('err_capacity')
      : earlyBird && (ebPriceN === null || ebPriceN < 0 || ebPriceN >= priceN) ? k('err_eb_price')
      : earlyBird && ebQtyN !== null && (!Number.isInteger(ebQtyN) || ebQtyN < 1) ? k('err_eb_qty')
      : null,
    door: scanner && scannerName.trim().length === 0 ? k('err_scanner') : null,
  };
  const idx = STEPS.indexOf(step);
  const [tried, setTried] = useState(false);

  const next = () => {
    if (errors[step]) { setTried(true); return; }
    setTried(false);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
    else void submit();
  };

  const submit = async () => {
    try {
      const res = await create.mutateAsync({
        name, description, image, dates,
        start_time: startTime, end_time: endTime || null,
        location_name: location.trim() || null, meeting_point: meeting.trim() || null,
        price: priceN ?? 0, capacity: capN, min_attendees: Number(minAttendees) || 0,
        early_bird_price: earlyBird ? ebPriceN : null, early_bird_quantity: earlyBird ? ebQtyN : null,
        sales_end: null,
        scanner_name: scanner ? scannerName.trim() : null,
      });
      setDone(res);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      toast.error(code === 'limit' ? k('err_limit') : k('err_save'), { description: code && code !== 'limit' ? code : undefined });
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const url = await uploadImage(f);
    if (url) setImage(url);
  };

  if (done) {
    const link = done.scanner_token ? scannerUrl(done.scanner_token) : null;
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <div className="text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><PartyPopper className="h-8 w-8" /></span>
          <h1 className="text-2xl font-bold">{k('done_title')}</h1>
          <p className="mt-2 text-muted-foreground">{k('done_text', { count: done.event_ids.length })}</p>
        </div>
        {link && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="font-semibold">{k('done_scanner_title', { name: scannerName })}</p>
              <div className="rounded-xl bg-white p-3"><QRCode value={link} size={176} /></div>
              <p className="text-sm text-muted-foreground">{k('done_scanner_text')}</p>
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => { void navigator.clipboard.writeText(link).then(() => toast.success(k('copied'))); }}><Copy className="mr-2 h-4 w-4" />{k('copy_link')}</Button>
                <Button asChild className="flex-1"><a href={link} target="_blank" rel="noreferrer"><DoorOpen className="mr-2 h-4 w-4" />{k('open_scanner')}</a></Button>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => navigate(`/admin/events/${done.event_ids[0]}`)}>{k('to_event')}</Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/admin/events')}>{k('to_overview')}</Button>
        </div>
      </div>
    );
  }

  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5"><Label>{label}</Label>{el}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/events"><ArrowLeft className="mr-1 h-4 w-4" />{t('events.back')}</Link></Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{k('title')}</h1>
        <p className="text-sm text-muted-foreground">{k('subtitle')}</p>
      </div>

      {/* Stappen */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" disabled={i > idx} onClick={() => setStep(s)}
              className={cn('w-full rounded-lg border px-2 py-2 text-left text-xs transition-colors',
                i === idx ? 'border-primary bg-primary/5 font-semibold' : i < idx ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-muted-foreground')}>
              <span className="flex items-center gap-1">{i < idx ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}.</span>}<span className="truncate">{k(`step_${s}`)}</span></span>
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-5 p-5">
          {step === 'what' && (
            <>
              {field(k('name'), <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={k('name_ph')} />)}
              {field(k('description'), <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={k('description_ph')} />)}
              <div className="space-y-1.5">
                <Label>{k('photo')}</Label>
                {image ? (
                  <div className="relative w-fit">
                    <img src={image} alt="" className="h-36 rounded-lg object-cover" />
                    <button type="button" onClick={() => setImage(null)} aria-label={k('photo_remove')} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-primary/50">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    {k('photo_add')}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
              </div>
            </>
          )}

          {step === 'when' && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div><p className="text-sm font-medium">{k('repeat')}</p><p className="text-xs text-muted-foreground">{k('repeat_hint')}</p></div>
                <Switch checked={repeat} onCheckedChange={setRepeat} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field(repeat ? k('first_date') : k('date'), <Input type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />)}
                {repeat && field(k('weeks'), <Input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} />)}
                {field(k('start_time'), <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />)}
                {field(k('end_time'), <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />)}
                {field(k('location'), <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={k('location_ph')} />)}
                {field(k('meeting_point'), <Input value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder={k('meeting_point_ph')} />)}
              </div>
              {!location.trim() && !meeting.trim() && <p className="text-xs text-amber-700 dark:text-amber-400">{t('events.readiness.meeting_point_warning')}</p>}
              {dates.length > 1 && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="mb-1 font-medium">{k('series_preview', { count: dates.length })}</p>
                  <p className="text-muted-foreground">{dates.slice(0, 4).map(fmt).join(' · ')}{dates.length > 4 ? ' …' : ''}</p>
                </div>
              )}
            </>
          )}

          {step === 'tickets' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {field(k('price'), <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25" />, k('price_hint'))}
                {field(k('capacity'), <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="40" />, k('capacity_hint'))}
                {field(k('min_attendees'), <Input type="number" min={0} value={minAttendees} onChange={(e) => setMinAttendees(e.target.value)} />, k('min_attendees_hint'))}
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-medium">{k('early_bird')}</p><p className="text-xs text-muted-foreground">{k('early_bird_hint')}</p></div>
                  <Switch checked={earlyBird} onCheckedChange={setEarlyBird} />
                </div>
                {earlyBird && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field(k('eb_price'), <Input inputMode="decimal" value={ebPrice} onChange={(e) => setEbPrice(e.target.value)} placeholder="20" />)}
                    {field(k('eb_qty'), <Input type="number" min={1} value={ebQty} onChange={(e) => setEbQty(e.target.value)} placeholder="10" />, k('eb_qty_hint'))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{k('more_types_hint')}</p>
            </>
          )}

          {step === 'door' && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div><p className="text-sm font-medium">{k('scanner')}</p><p className="text-xs text-muted-foreground">{k('scanner_hint')}</p></div>
                <Switch checked={scanner} onCheckedChange={setScanner} />
              </div>
              {scanner && field(k('scanner_name'), <Input value={scannerName} onChange={(e) => setScannerName(e.target.value)} />, dates.length > 1 ? k('scanner_series_hint') : undefined)}
              {/* Samenvatting vóór het aanmaken */}
              <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
                <p className="text-base font-semibold">{name}</p>
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" />{dates.length > 1 ? k('summary_series', { count: dates.length, first: dates[0] ? fmt(dates[0]) : '' }) : dates[0] ? fmt(dates[0]) : ''} · {startTime}{endTime ? `–${endTime}` : ''}</p>
                {(location || meeting) && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" />{[location, meeting].filter(Boolean).join(' · ')}</p>}
                <p className="flex items-center gap-2"><Ticket className="h-4 w-4 shrink-0" />{priceN ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(priceN) : k('free')} · {k('summary_capacity', { n: capN ?? 0 })}{earlyBird && ebPriceN !== null ? ` · ${k('summary_eb', { price: new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' }).format(ebPriceN) })}` : ''}</p>
              </div>
            </>
          )}

          {tried && errors[step] && <p className="text-sm font-medium text-destructive">{errors[step]}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {idx > 0 && <Button variant="outline" onClick={() => setStep(STEPS[idx - 1])}><ArrowLeft className="mr-1 h-4 w-4" />{k('back')}</Button>}
        <Button className="ml-auto min-w-40" onClick={next} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {idx < STEPS.length - 1 ? <>{k('next')}<ArrowRight className="ml-1 h-4 w-4" /></> : k('create')}
        </Button>
      </div>
    </div>
  );
}
