// PRINT-2 — Kassa › Bon & printers: alles over afdrukken en de bon op één plek.
//
// 1. Printers: een Star-bonprinter koppelen (CloudPRNT). De printer haalt zelf zijn opdrachten op bij
//    SellQo (edge function cloudprnt), dus er hoeft geen tablet of pc aan te staan. Het geheim
//    (printer-token) zie je één keer; in de databank staat enkel een SHA-256 (PRINT-1).
// 2. Posten: welke printer drukt de bonnen van welke post af (prep_stations.printer_id).
// 3. Bon na afrekenen: betaalbewijs afdrukken (kassa), betaalbewijs mailen na online betalen, en de
//    knop "Mail bon" op het afrekenscherm (horeca_pay_settings). De kassa vraagt nooit zelf naar een
//    e-mailadres. Met een geregistreerde kassa (FDM) maakt de kassa zelf het kasticket.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2, Plus, Printer, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LANG_CODES } from '@/i18n/languages';

interface PrinterRow { id: string; name: string; width_chars: number; lang: string; is_active: boolean; last_seen_at: string | null; last_status: string | null }
interface StationRow { id: string; name: string; kind: string; is_default: boolean; printer_id: string | null }
interface ReceiptSettings { receipt_print: boolean; receipt_printer_id: string | null; ticket_printer_id: string | null; mail_online: boolean; mail_button: boolean; online_pay: boolean }

const WIDTHS = [48, 42, 32] as const;
const NONE = 'none';
/** Een printer die de laatste 2 minuten pollde, staat aan. */
const ONLINE_MS = 120_000;

function randomToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256Hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(h, (x) => x.toString(16).padStart(2, '0')).join('');
}
const SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudprnt`;

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label={t('admin.horecaPrint.copy')}
          onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* geen klembord */ } }}>
          {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function HorecaPrinters() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = ['horeca-printers', tenantId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [p, s, r, f] = await Promise.all([
        supabase.from('printers' as never).select('id, name, width_chars, lang, is_active, last_seen_at, last_status')
          .eq('tenant_id' as never, tenantId as never).eq('protocol' as never, 'star_cloudprnt' as never).order('created_at' as never),
        supabase.from('prep_stations' as never).select('id, name, kind, is_default, printer_id')
          .eq('tenant_id' as never, tenantId as never).eq('is_active' as never, true as never).order('sort' as never),
        supabase.from('horeca_pay_settings' as never).select('receipt_print, receipt_printer_id, ticket_printer_id, mail_online, mail_button, online_pay')
          .eq('tenant_id' as never, tenantId as never).maybeSingle(),
        supabase.from('pos_terminals').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).eq('settings->fiscal->>mode' as never, 'fdm' as never),
      ]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      if (f.error) throw f.error;
      const rs = r.data as Partial<ReceiptSettings> | null;
      return {
        printers: (p.data ?? []) as unknown as PrinterRow[],
        stations: (s.data ?? []) as unknown as StationRow[],
        receipt: {
          receipt_print: rs?.receipt_print === true, receipt_printer_id: rs?.receipt_printer_id ?? null, ticket_printer_id: rs?.ticket_printer_id ?? null,
          mail_online: rs?.mail_online === true, mail_button: rs?.mail_button !== false, online_pay: rs?.online_pay === true,
        } as ReceiptSettings,
        fiscal: (f.count ?? 0) > 0,
      };
    },
  });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [width, setWidth] = useState<string>('48');
  const [lang, setLang] = useState<string>('nl');
  const [busy, setBusy] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ name: string; token: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  if (isLoading || !data) {
    return <Card><CardContent className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }
  const active = data.printers.filter((p) => p.is_active);

  const addPrinter = async () => {
    if (!tenantId || !name.trim()) return;
    setBusy('add');
    const token = randomToken();
    const { error } = await supabase.from('printers' as never).insert({
      tenant_id: tenantId, name: name.trim().slice(0, 80), kind: 'kitchen', protocol: 'star_cloudprnt',
      width_chars: Number(width), lang, token_hash: await sha256Hex(token),
    } as never);
    setBusy(null);
    if (error) { toast.error(t('admin.horecaPrint.save_failed', { reason: error.message })); return; }
    setAdding(false);
    setSecret({ name: name.trim(), token });
    setName('');
    refresh();
  };

  const newKey = async (p: PrinterRow) => {
    setBusy(`key:${p.id}`);
    const token = randomToken();
    const { error } = await supabase.from('printers' as never).update({ token_hash: await sha256Hex(token) } as never).eq('id' as never, p.id as never);
    setBusy(null);
    if (error) { toast.error(t('admin.horecaPrint.save_failed', { reason: error.message })); return; }
    setSecret({ name: p.name, token });
  };

  const updatePrinter = async (p: PrinterRow, patch: Partial<Pick<PrinterRow, 'is_active' | 'width_chars' | 'lang'>>) => {
    setBusy(`upd:${p.id}`);
    const { error } = await supabase.from('printers' as never).update(patch as never).eq('id' as never, p.id as never);
    setBusy(null);
    if (error) { toast.error(t('admin.horecaPrint.save_failed', { reason: error.message })); return; }
    refresh();
  };

  const testPrint = async (p: PrinterRow) => {
    setBusy(`test:${p.id}`);
    const { data: res, error } = await supabase.functions.invoke('horeca-print', { body: { kind: 'test', printer_id: p.id } });
    setBusy(null);
    if (error || (res as { error?: string } | null)?.error) { toast.error(t('admin.horecaPrint.test_failed')); return; }
    toast.success(t('admin.horecaPrint.test_sent'));
  };

  const setStationPrinter = async (s: StationRow, printerId: string) => {
    setBusy(`st:${s.id}`);
    const { error } = await supabase.from('prep_stations' as never).update({ printer_id: printerId === NONE ? null : printerId } as never).eq('id' as never, s.id as never);
    setBusy(null);
    if (error) { toast.error(t('admin.horecaPrint.save_failed', { reason: error.message })); return; }
    refresh();
  };

  const saveReceipt = async (patch: Partial<ReceiptSettings>) => {
    if (!tenantId) return;
    setBusy('receipt');
    const { error } = await supabase.from('horeca_pay_settings' as never).upsert({ tenant_id: tenantId, ...patch } as never, { onConflict: 'tenant_id' });
    setBusy(null);
    if (error) { toast.error(t('admin.horecaPrint.save_failed', { reason: error.message })); return; }
    await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['kassa-pay-settings', tenantId] })]);
  };

  const isOnline = (p: PrinterRow) => !!p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() < ONLINE_MS;
  const printerSelect = (value: string | null, onChange: (v: string) => void, id: string, disabled?: boolean) => (
    <Select value={value ?? NONE} onValueChange={onChange} disabled={disabled || busy !== null}>
      <SelectTrigger id={id} className="h-11 w-full sm:w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('admin.horecaPrint.no_printer')}</SelectItem>
        {/* Een uitgezette printer die nog gekoppeld is, blijft zichtbaar (met "uit") in plaats van een lege keuze. */}
        {data.printers.filter((p) => p.is_active || p.id === value).map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.is_active ? p.name : `${p.name} (${t('admin.horecaPrint.off')})`}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>{t('admin.horecaPrint.printers_title')}</CardTitle>
            <CardDescription>{t('admin.horecaPrint.printers_desc')}</CardDescription>
          </div>
          <Button onClick={() => setAdding(true)} className="h-11 shrink-0" aria-label={t('admin.horecaPrint.add')}><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{t('admin.horecaPrint.add')}</span></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.printers.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t('admin.horecaPrint.none_yet')}</p>
          ) : data.printers.map((p) => (
            <div key={p.id} className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{p.name}</span>
                {!p.is_active ? <Badge variant="secondary">{t('admin.horecaPrint.off')}</Badge>
                  : isOnline(p) ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{t('admin.horecaPrint.online')}</Badge>
                  : <Badge variant="outline">{p.last_seen_at ? t('admin.horecaPrint.last_seen', { time: new Date(p.last_seen_at).toLocaleString() }) : t('admin.horecaPrint.never_seen')}</Badge>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`w-${p.id}`} className="text-xs text-muted-foreground">{t('admin.horecaPrint.width')}</Label>
                  <Select value={String(p.width_chars)} onValueChange={(v) => updatePrinter(p, { width_chars: Number(v) })} disabled={busy !== null}>
                    <SelectTrigger id={`w-${p.id}`} className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{WIDTHS.map((w) => <SelectItem key={w} value={String(w)}>{t(`admin.horecaPrint.width_${w}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`l-${p.id}`} className="text-xs text-muted-foreground">{t('admin.horecaPrint.lang')}</Label>
                  <Select value={p.lang} onValueChange={(v) => updatePrinter(p, { lang: v })} disabled={busy !== null}>
                    <SelectTrigger id={`l-${p.id}`} className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{LANG_CODES.map((c) => <SelectItem key={c} value={c}>{t(`admin.horecaPrint.lang_${c}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button variant="outline" className="h-11" disabled={!p.is_active || busy !== null} onClick={() => testPrint(p)}>
                  {busy === `test:${p.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}{t('admin.horecaPrint.test')}
                </Button>
                <Button variant="outline" className="h-11" disabled={busy !== null} onClick={() => newKey(p)}>
                  <KeyRound className="mr-2 h-4 w-4" />{t('admin.horecaPrint.new_key')}
                </Button>
                <Button variant="ghost" className="h-11" disabled={busy !== null} onClick={() => updatePrinter(p, { is_active: !p.is_active })}>
                  <Power className="mr-2 h-4 w-4" />{p.is_active ? t('admin.horecaPrint.turn_off') : t('admin.horecaPrint.turn_on')}
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t('admin.horecaPrint.star_only')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.horecaPrint.stations_title')}</CardTitle>
          <CardDescription>{t('admin.horecaPrint.stations_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* PRINT-2b: bonnen zonder post (geen posten, of geen standaardpost) hebben ook een printer nodig. */}
          {data.stations.length === 0 || !data.stations.some((s) => s.is_default) ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label htmlFor="st-none" className="text-sm">{t('admin.horecaPrint.no_station_row')}</Label>
                <p className="text-xs text-muted-foreground">{data.stations.length === 0 ? t('admin.horecaPrint.no_station_hint_none') : t('admin.horecaPrint.no_station_hint_rest')}</p>
              </div>
              {printerSelect(data.receipt.ticket_printer_id, (v) => saveReceipt({ ticket_printer_id: v === NONE ? null : v }), 'st-none', active.length === 0)}
            </div>
          ) : null}
          {data.stations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('admin.horecaPrint.no_stations')}{' '}
              <Link to="/admin/bestellen?tab=posten" className="underline">{t('admin.horecaPrint.to_stations')}</Link>
            </p>
          ) : data.stations.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor={`st-${s.id}`} className="text-sm">
                {s.name}{s.is_default ? <span className="ml-2 text-xs text-muted-foreground">{t('admin.horecaPrint.default_station')}</span> : null}
              </Label>
              {printerSelect(s.printer_id, (v) => setStationPrinter(s, v), `st-${s.id}`, active.length === 0)}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.horecaPrint.receipt_title')}</CardTitle>
          <CardDescription>{data.fiscal ? t('admin.horecaPrint.receipt_desc_fiscal') : t('admin.horecaPrint.receipt_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="rc-print" className="text-sm font-medium">{t('admin.horecaPrint.receipt_print')}</Label>
                <p className="text-xs text-muted-foreground">{t('admin.horecaPrint.receipt_print_hint')}{active.length === 0 ? ` ${t('admin.horecaPrint.receipt_print_first')}` : ''}</p>
              </div>
              <Switch id="rc-print" checked={data.receipt.receipt_print} disabled={busy !== null || data.fiscal || active.length === 0}
                onCheckedChange={(v) => saveReceipt({ receipt_print: v, receipt_printer_id: data.receipt.receipt_printer_id ?? active[0]?.id ?? null })} />
            </div>
            {data.receipt.receipt_print && !data.fiscal ? printerSelect(data.receipt.receipt_printer_id, (v) => saveReceipt({ receipt_printer_id: v === NONE ? null : v, receipt_print: v !== NONE }), 'rc-printer') : null}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="rc-online" className="text-sm font-medium">{t('admin.horecaPrint.mail_online')}</Label>
              <p className="text-xs text-muted-foreground">{data.receipt.online_pay ? t('admin.horecaPrint.mail_online_hint') : t('admin.horecaPrint.mail_online_needs_online')}</p>
            </div>
            <Switch id="rc-online" checked={data.receipt.mail_online} disabled={busy !== null || data.fiscal || !data.receipt.online_pay}
              onCheckedChange={(v) => saveReceipt({ mail_online: v })} />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="rc-button" className="text-sm font-medium">{t('admin.horecaPrint.mail_button')}</Label>
              <p className="text-xs text-muted-foreground">{t('admin.horecaPrint.mail_button_hint')}</p>
            </div>
            <Switch id="rc-button" checked={data.receipt.mail_button} disabled={busy !== null || data.fiscal}
              onCheckedChange={(v) => saveReceipt({ mail_button: v })} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.horecaPrint.add_title')}</DialogTitle>
            <DialogDescription>{t('admin.horecaPrint.add_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pr-name">{t('admin.horecaPrint.name')}</Label>
              <Input id="pr-name" value={name} maxLength={80} placeholder={t('admin.horecaPrint.name_placeholder')} onChange={(e) => setName(e.target.value)} className="h-11" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pr-width">{t('admin.horecaPrint.width')}</Label>
                <Select value={width} onValueChange={setWidth}>
                  <SelectTrigger id="pr-width" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{WIDTHS.map((w) => <SelectItem key={w} value={String(w)}>{t(`admin.horecaPrint.width_${w}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pr-lang">{t('admin.horecaPrint.lang')}</Label>
                <Select value={lang} onValueChange={setLang}>
                  <SelectTrigger id="pr-lang" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANG_CODES.map((c) => <SelectItem key={c} value={c}>{t(`admin.horecaPrint.lang_${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="h-11 w-full sm:w-auto" disabled={!name.trim() || busy !== null} onClick={addPrinter}>
              {busy === 'add' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('admin.horecaPrint.add_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secret} onOpenChange={(o) => { if (!o) setSecret(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.horecaPrint.setup_title', { name: secret?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('admin.horecaPrint.setup_desc')}</DialogDescription>
          </DialogHeader>
          {secret ? (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>{t('admin.horecaPrint.setup_step1')}</li>
                <li>{t('admin.horecaPrint.setup_step2')}</li>
                <li>{t('admin.horecaPrint.setup_step3')}</li>
              </ol>
              <CopyField label={t('admin.horecaPrint.server_url')} value={SERVER_URL} />
              <div className="grid gap-3 sm:grid-cols-2">
                <CopyField label={t('admin.horecaPrint.username')} value="sellqo" />
                <CopyField label={t('admin.horecaPrint.password')} value={secret.token} />
              </div>
              <CopyField label={t('admin.horecaPrint.url_with_key')} value={`${SERVER_URL}?key=${secret.token}`} />
              <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t('admin.horecaPrint.secret_once')}</p>
            </div>
          ) : null}
          <DialogFooter><Button className="h-11 w-full sm:w-auto" onClick={() => setSecret(null)}>{t('admin.horecaPrint.done')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
